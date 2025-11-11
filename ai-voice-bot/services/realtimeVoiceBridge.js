import WebSocket from 'ws';
import { randomUUID } from 'crypto';

import {
  decodeTwilioAudio,
  encodePcmToTwilioBase64Frames,
} from '../utils/audio.js';
import { createConversationLogger } from '../utils/logger.js';

const OPENAI_REALTIME_MODEL = 'gpt-4o-realtime-preview';
const OPENAI_REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${OPENAI_REALTIME_MODEL}`;
const DEFAULT_SILENCE_TIMEOUT_MS = Number(
  process.env.SILENCE_TIMEOUT_MS ?? 900
);

const systemPrompt = `
You are a warm, friendly, and professional receptionist for a small business.
Greet callers with: "Hi there! Thanks for calling. How can I assist you today?"
Keep responses concise, empathetic, and conversational.
Avoid robotic or repetitive phrases. Do not mention that you are an AI system.
Confirm key details, offer help proactively, and close the call politely when appropriate.
`.trim();

export class RealtimeVoiceBridge {
  constructor(twilioSocket) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY must be set before handling calls.');
    }

    this.twilioSocket = twilioSocket;
    this.callSid = null;
    this.streamSid = null;
    this.sessionId = randomUUID();
    this.awaitingResponse = false;
    this.commitTimer = null;
    this.closed = false;
    this.logger = createConversationLogger(this.sessionId);
    this.openAiSocket = null;
    this.currentCustomerTranscript = '';
    this.currentAssistantTranscript = '';

    this.handleTwilioMessage = this.handleTwilioMessage.bind(this);
    this.handleTwilioClose = this.handleTwilioClose.bind(this);
    this.handleTwilioError = this.handleTwilioError.bind(this);

    this.twilioSocket.on('message', this.handleTwilioMessage);
    this.twilioSocket.once('close', this.handleTwilioClose);
    this.twilioSocket.once('error', this.handleTwilioError);
  }

  async handleTwilioMessage(messageBuffer) {
    try {
      const payload = JSON.parse(messageBuffer.toString());

      switch (payload.event) {
        case 'start':
          await this.onCallStart(payload);
          break;
        case 'media':
          await this.onMedia(payload);
          break;
        case 'mark':
          break;
        case 'stop':
          await this.shutdown('twilio-stop');
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Failed to handle Twilio message', error);
    }
  }

  async onCallStart(payload) {
    this.callSid = payload.start?.callSid ?? this.sessionId;
    this.streamSid = payload.start?.streamSid ?? null;

    this.logger.push({
      speaker: 'system',
      text: `Call connected (${this.callSid}).`,
      timestamp: Date.now(),
    });

    await this.connectToOpenAi();
  }

  async connectToOpenAi() {
    if (this.openAiSocket) {
      return;
    }

    this.openAiSocket = new WebSocket(OPENAI_REALTIME_URL, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    this.openAiSocket.on('open', () => {
      this.onOpenAiReady();
    });

    this.openAiSocket.on('message', (event) => {
      this.onOpenAiEvent(event);
    });

    this.openAiSocket.on('error', (error) => {
      console.error('OpenAI realtime error', error);
      this.shutdown('openai-error');
    });

    this.openAiSocket.on('close', () => {
      this.shutdown('openai-closed');
    });
  }

  onOpenAiReady() {
    const configEvent = {
      type: 'session.update',
      session: {
        voice: 'verse',
        instructions: systemPrompt,
        modalities: ['text', 'audio'],
        input_audio_format: { type: 'pcm16', sample_rate: 8000 },
        output_audio_format: { type: 'pcm16', sample_rate: 8000 },
      },
    };

    this.openAiSocket.send(JSON.stringify(configEvent));
    this.logger.push({
      speaker: 'system',
      text: 'OpenAI realtime session established.',
      timestamp: Date.now(),
    });
  }

  async onMedia(payload) {
    if (!this.openAiSocket || this.openAiSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    const audioBuffer = decodeTwilioAudio(payload.media.payload);
    const audioBase64 = audioBuffer.toString('base64');

    this.openAiSocket.send(
      JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: audioBase64,
      })
    );

    this.scheduleCommit();
  }

  scheduleCommit() {
    if (this.awaitingResponse) {
      return;
    }

    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
    }

    this.commitTimer = setTimeout(() => {
      this.flushInputBuffer();
    }, DEFAULT_SILENCE_TIMEOUT_MS);
  }

  flushInputBuffer() {
    if (
      !this.openAiSocket ||
      this.openAiSocket.readyState !== WebSocket.OPEN ||
      this.awaitingResponse
    ) {
      return;
    }

    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = null;
    }

    this.awaitingResponse = true;

    this.openAiSocket.send(
      JSON.stringify({
        type: 'input_audio_buffer.commit',
      })
    );

    this.openAiSocket.send(
      JSON.stringify({
        type: 'response.create',
        response: {
          modalities: ['text', 'audio'],
          instructions: 'Continue assisting the caller naturally.',
        },
      })
    );
  }

  onOpenAiEvent(event) {
    if (!event) {
      return;
    }

    let message;

    try {
      message = JSON.parse(event.toString());
    } catch (error) {
      console.error('Unable to parse OpenAI event', error);
      return;
    }

    switch (message.type) {
      case 'response.output_text.delta':
        this.currentAssistantTranscript += message.delta ?? '';
        break;
      case 'response.output_text.completed':
        if (this.currentAssistantTranscript.trim().length) {
          this.logger.push({
            speaker: 'assistant',
            text: this.currentAssistantTranscript.trim(),
            timestamp: Date.now(),
          });
        }
        this.currentAssistantTranscript = '';
        break;
      case 'response.output_audio.delta':
        this.sendAudioToTwilio(message.audio);
        break;
      case 'response.completed':
        if (this.currentAssistantTranscript.trim().length) {
          this.logger.push({
            speaker: 'assistant',
            text: this.currentAssistantTranscript.trim(),
            timestamp: Date.now(),
          });
          this.currentAssistantTranscript = '';
        }
        this.awaitingResponse = false;
        break;
      case 'response.input_audio_transcription.delta':
        this.currentCustomerTranscript += message.delta ?? '';
        break;
      case 'response.input_audio_transcription.completed':
        if (this.currentCustomerTranscript.trim().length) {
          this.logger.push({
            speaker: 'customer',
            text: this.currentCustomerTranscript.trim(),
            timestamp: Date.now(),
          });
        }
        this.currentCustomerTranscript = '';
        break;
      case 'error':
      case 'response.error':
        console.error('OpenAI realtime reported error', message);
        break;
      default:
        break;
    }
  }

  sendAudioToTwilio(pcmBase64) {
    if (
      !pcmBase64 ||
      !this.twilioSocket ||
      this.twilioSocket.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    const frames = encodePcmToTwilioBase64Frames(pcmBase64);

    frames.forEach((payload) => {
      const response = {
        event: 'media',
        streamSid: this.streamSid,
        media: { payload },
      };

      this.twilioSocket.send(JSON.stringify(response));
    });
  }

  handleTwilioClose() {
    this.shutdown('twilio-closed');
  }

  handleTwilioError(error) {
    console.error('Twilio websocket error', error);
    this.shutdown('twilio-error');
  }

  async shutdown(reason) {
    if (this.closed) {
      return;
    }

    this.closed = true;

    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = null;
    }

    this.logger.push({
      speaker: 'system',
      text: `Shutting down voice bridge (${reason}).`,
      timestamp: Date.now(),
    });

    if (this.currentCustomerTranscript.trim().length) {
      this.logger.push({
        speaker: 'customer',
        text: this.currentCustomerTranscript.trim(),
        timestamp: Date.now(),
      });
      this.currentCustomerTranscript = '';
    }

    if (this.currentAssistantTranscript.trim().length) {
      this.logger.push({
        speaker: 'assistant',
        text: this.currentAssistantTranscript.trim(),
        timestamp: Date.now(),
      });
      this.currentAssistantTranscript = '';
    }

    try {
      await this.logger.persist();
    } catch (error) {
      console.error('Failed to persist call log', error);
    }

    try {
      if (this.openAiSocket) {
        if (this.openAiSocket.readyState === WebSocket.OPEN) {
          this.openAiSocket.send(
            JSON.stringify({
              type: 'session.close',
            })
          );
          this.openAiSocket.close();
        }
      }
    } catch (error) {
      console.error('Error while closing OpenAI socket', error);
    }

    if (this.twilioSocket && this.twilioSocket.readyState === WebSocket.OPEN) {
      this.twilioSocket.close();
    }
  }
}

export const createRealtimeVoiceBridge = (twilioSocket) =>
  new RealtimeVoiceBridge(twilioSocket);

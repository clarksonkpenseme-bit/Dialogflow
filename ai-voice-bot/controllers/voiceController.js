import VoiceResponse from 'twilio/lib/twiml/VoiceResponse.js';

const DEFAULT_GREETING =
  'Hi there! Thanks for calling. How can I assist you today?';

export const handleVoiceWebhook = (req, res) => {
  const baseUrl = process.env.PUBLIC_BASE_URL;

  if (!baseUrl) {
    return res
      .status(500)
      .send('Server misconfigured: PUBLIC_BASE_URL is not set.');
  }

  const streamUrl = `${baseUrl.replace(/\/$/, '')}/voice/stream`;
  const voiceResponse = new VoiceResponse();

  // Optional greeting while the media stream initializes.
  voiceResponse.say(
    { voice: 'Polly.Joanna', language: 'en-US' },
    DEFAULT_GREETING
  );

  const connect = voiceResponse.connect();
  connect.stream({
    url: streamUrl,
    track: 'inbound_track',
    name: 'customer-audio',
  });

  res.type('text/xml').send(voiceResponse.toString());
};

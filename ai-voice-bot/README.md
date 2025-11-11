# AI Voice Bot Backend

Real-time voice assistant backend that bridges Twilio Programmable Voice with OpenAI's Realtime API (`gpt-4o-realtime-preview`). The assistant listens and responds with low latency, speaks in a warm and friendly tone, and logs every conversation.

## Features
- Express server with Twilio Voice webhook and media stream endpoint.
- Live audio bridge between Twilio and OpenAI Realtime (bidirectional).
- Automatic conversation logging to `logs/*.txt` with timestamps.
- Optional `/generate-voice` helper endpoint that returns synthesized speech for any text.
- Modular structure (`routes`, `controllers`, `services`, `utils`) for clarity and testability.

## Prerequisites
- Node.js 18.17+
- Twilio account with Programmable Voice enabled.
- OpenAI API access with Realtime capability enabled.

## Installation
```bash
cd ai-voice-bot
npm install
```

## Environment Variables
Duplicate `.env` and fill the required values:

| Variable | Description |
| --- | --- |
| `PORT` | Port for the Express app (default `3000`). |
| `PUBLIC_BASE_URL` | Public HTTPS URL to your server (e.g. ngrok tunnel). Used to build the Twilio media stream URL. |
| `OPENAI_API_KEY` | OpenAI API key with Realtime access. |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID (optional but useful for future expansion). |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token (optional unless you add signature validation). |
| `TWILIO_API_KEY`, `TWILIO_API_SECRET` | Optional keys for creating access tokens if needed. |
| `SILENCE_TIMEOUT_MS` | (Optional) Override the silence detection window before the AI responds (default `900`). |

## Running Locally
```bash
npm run dev
# or
npm start
```

## Twilio Configuration
1. Start ngrok (or equivalent) pointing to your local port: `ngrok http 3000`.
2. Copy the HTTPS forwarding URL and set `PUBLIC_BASE_URL` in `.env` (no trailing slash).
3. In the Twilio Console, configure the **Voice & Fax** webhook for your phone number:<br>
   - **HTTP Method**: `POST`<br>
   - **URL**: `https://<your-ngrok>.ngrok-free.app/voice`
4. Save the configuration. Incoming calls will now be routed to the Express server, which issues TwiML that starts streaming audio to `/voice/stream`.

> The comment in `routes/voiceRoute.js` also marks where to point the webhook and stream URL if you prefer to edit code directly.

## Optional `/generate-voice`
POST `http://localhost:3000/generate-voice` with JSON payload:
```json
{
  "text": "Custom message to synthesize",
  "voice": "verse",
  "format": "mp3"
}
```
The response streams back audio (MP3 by default).

## Conversation Logs
- Logs are saved under `logs/` as timestamped `.txt` files.
- Each entry is timestamped with ISO strings and tagged with the speaker (`customer`, `assistant`, `system`). Ensure this folder remains writable in production.

## Error Handling & Resilience
- WebSocket disconnects from Twilio or OpenAI automatically trigger graceful shutdown and log persistence.
- Audio buffering uses a configurable silence timeout to minimize latency while avoiding premature interruptions.

## Next Steps
- Add Twilio request signature validation for extra security.
- Persist logs in a database if long-term storage or analytics are required.
- Extend `RealtimeVoiceBridge` with business-specific workflows (CRM lookups, booking APIs, etc.).

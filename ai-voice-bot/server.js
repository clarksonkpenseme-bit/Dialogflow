import './config/env.js';

import http from 'http';
import express from 'express';
import voiceRoute from './routes/voiceRoute.js';
import { handleGenerateVoice } from './controllers/ttsController.js';
import { registerVoiceSocketHandling } from './services/voiceSessionManager.js';
import { ensureLogDir } from './utils/logger.js';

ensureLogDir();

const app = express();
app.use(express.json({ limit: '5mb' }));

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'AI voice assistant is ready.' });
});

// Twilio should point its Voice webhook (POST) at `${PUBLIC_BASE_URL}/voice`
app.use('/voice', voiceRoute);

// Optional helper route to generate speech audio from plain text.
app.post('/generate-voice', handleGenerateVoice);

const server = http.createServer(app);

registerVoiceSocketHandling(server);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Voice assistant server listening on http://localhost:${PORT}`);
});

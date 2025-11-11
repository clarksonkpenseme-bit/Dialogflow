import express from 'express';
import { handleVoiceWebhook } from '../controllers/voiceController.js';

const router = express.Router();

// Configure Twilio Voice webhook to POST to `${PUBLIC_BASE_URL}/voice`
router.post('/', handleVoiceWebhook);

export default router;

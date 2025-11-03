import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';
// import axios from 'axios';

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});



// Root endpoint
app.get('/', (req, res) => {
  res.send('✅ OpenAI Chatbot is running smoothly!');
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('📩 Received chat message:', message);

    // Generate response using OpenAI
    console.log('🤖 Generating AI response...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-0125-preview',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Answer the user as best as you can.' },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const reply = completion.choices[0].message.content;
    console.log('✨ AI response generated successfully');

    res.json({ reply });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ 
      error: 'An error occurred while processing your request',
      details: error.message 
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
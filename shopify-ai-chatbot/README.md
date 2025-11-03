
# OpenAI Chatbot

A production-ready Node.js application that uses OpenAI's GPT-4 to create an intelligent assistant.

## Features

- Express.js server with REST API endpoints
- OpenAI-powered intelligent responses
- Environment-based configuration
- Error handling and logging
- ESM module support

## Prerequisites

- Node.js 18.x or higher
- OpenAI API key

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your credentials:
     - `OPENAI_API_KEY`: Your OpenAI API key
     - `PORT`: Server port (default: 3000)

## Usage

Start the server:
```bash
npm start
```

The server will run at `http://localhost:3000`


### API Endpoints

- `GET /`: Health check endpoint
- `POST /chat`: Send a message to the chatbot
  - Request body: `{ "message": "your message here" }`
  - Response: `{ "reply": "AI-generated response" }`

## Error Handling

The application includes comprehensive error handling for:
- Invalid requests
- API failures
- Server errors

All errors are properly logged and return appropriate HTTP status codes.

## Production Deployment

This application is ready for deployment on platforms like Render or Heroku:
- Uses environment variables for configuration
- Includes proper error handling
- Follows Node.js best practices
- Uses ESM modules
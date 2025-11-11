import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const handleGenerateVoice = async (req, res) => {
  const { text, voice = 'verse', format = 'mp3' } = req.body ?? {};

  if (!text) {
    return res
      .status(400)
      .json({ error: 'Provide the `text` field to synthesize speech.' });
  }

  try {
    const response = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice,
      input: text,
      format,
    });

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    const mimeType =
      format === 'wav'
        ? 'audio/wav'
        : format === 'ogg'
        ? 'audio/ogg'
        : 'audio/mpeg';

    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="openai-voice.' + format + '"'
    );
    res.send(audioBuffer);
  } catch (error) {
    console.error('generate-voice error', error);
    res.status(500).json({
      error: 'Unable to generate voice audio.',
      details: error.message,
    });
  }
};

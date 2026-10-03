const axios = require('axios');
const env = require('../config/env');

const TIMEOUT_MS = 15000;

const complete = async (prompt, options = {}) => {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      contents: [
        {
          parts: [
            {
              text: `You are a workflow decision engine. Always respond with valid JSON only. No extra text.\n\n${prompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 500,
      },
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: options.timeout || TIMEOUT_MS,
    }
  );

  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const usage = response.data?.usageMetadata;

  return {
    text,
    tokenUsage: {
      promptTokens: usage?.promptTokenCount || 0,
      completionTokens: usage?.candidatesTokenCount || 0,
      totalTokens: usage?.totalTokenCount || 0,
    },
  };
};

module.exports = { complete };
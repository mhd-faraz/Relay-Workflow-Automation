const axios = require('axios');
const env = require('../config/env');

const TIMEOUT_MS = 15000;

const complete = async (prompt, options = {}) => {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a workflow decision engine. Always respond with valid JSON only. No extra text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
    },
    {
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: options.timeout || TIMEOUT_MS,
    }
  );

  const message = response.data.choices?.[0]?.message?.content;
  const usage = response.data.usage;

  return {
    text: message,
    tokenUsage: {
      promptTokens: usage?.prompt_tokens || 0,
      completionTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0,
    },
  };
};

module.exports = { complete };
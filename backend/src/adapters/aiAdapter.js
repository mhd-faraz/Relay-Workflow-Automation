const env = require('../config/env');
const openaiAdapter = require('./openaiAdapter');
const geminiAdapter = require('./geminiAdapter');
const groqAdapter = require('./groqAdapter');

// Mock adapter for testing
const mockAdapter = {
  complete: async (prompt) => {
    console.log('[AI Mock] Prompt received:', prompt.slice(0, 80));
    return {
      text: JSON.stringify({
        decision: 'approved',
        reason: 'Mock AI response for testing',
        confidence: 0.95,
      }),
      tokenUsage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    };
  },
};

const getAiAdapter = () => {
  if (env.NODE_ENV === 'test') return mockAdapter;

  switch (env.AI_PROVIDER) {
    case 'openai':  return openaiAdapter;
    case 'gemini':  return geminiAdapter;
    case 'groq':    return groqAdapter;
    default:        return mockAdapter;
  }
};

module.exports = { getAiAdapter, mockAdapter };
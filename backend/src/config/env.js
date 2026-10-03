require('dotenv').config();

const env = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/relay',

  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT) || 6379,

  AI_PROVIDER: process.env.AI_PROVIDER || 'groq',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',

  GMAIL_USER: process.env.GMAIL_USER || '',
  GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD || '',

  JWT_SECRET: process.env.JWT_SECRET || 'relay-dev-secret-change-in-production',

  MAX_STEPS_PER_RUN: parseInt(process.env.MAX_STEPS_PER_RUN) || 100,
};

const required = ['MONGODB_URI', 'REDIS_HOST'];
for (const key of required) {
  if (!env[key]) throw new Error(`Missing required env variable: ${key}`);
}

module.exports = env;
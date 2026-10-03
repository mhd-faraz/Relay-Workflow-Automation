const IORedis = require('ioredis');
const env = require('./env');

let redisClient = null;

const getRedisClient = () => {
  if (redisClient) return redisClient;

  redisClient = new IORedis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  redisClient.on('connect', () => console.log('[Redis] Connected'));
  redisClient.on('error', (err) => console.error('[Redis] Error:', err.message));

  return redisClient;
};

const disconnectRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Redis] Disconnected');
  }
};

module.exports = { getRedisClient, disconnectRedis };
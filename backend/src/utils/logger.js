const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = process.env.NODE_ENV === 'production' ? 1 : 3;

const format = (level, message, meta = null) => {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  return meta ? `${base} ${JSON.stringify(meta)}` : base;
};

const logger = {
  error: (msg, meta) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.error)
      console.error(format('error', msg, meta));
  },
  warn: (msg, meta) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.warn)
      console.warn(format('warn', msg, meta));
  },
  info: (msg, meta) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.info)
      console.log(format('info', msg, meta));
  },
  debug: (msg, meta) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.debug)
      console.log(format('debug', msg, meta));
  },
};

module.exports = logger;
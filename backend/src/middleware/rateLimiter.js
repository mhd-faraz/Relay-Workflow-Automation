const requests = new Map();

const rateLimiter = (maxRequests = 100, windowMs = 60000) => {
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    if (!requests.has(key)) {
      requests.set(key, { count: 1, startTime: now });
      return next();
    }

    const record = requests.get(key);

    if (now - record.startTime > windowMs) {
      requests.set(key, { count: 1, startTime: now });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
      });
    }

    record.count++;
    next();
  };
};

module.exports = rateLimiter;
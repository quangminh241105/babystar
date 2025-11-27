/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting requests per time window
 */

// Create a rate limiter with configurable options
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000; // Default: 1 minute
  const max = options.max || 20; // Default: 20 requests per window
  const keyPrefix = options.keyPrefix || 'rateLimit';
  const message = options.message || 'Rate limit exceeded. Please try again later.';

  return (req, res, next) => {
    if (!req.session) req.session = {};
    
    const key = `${keyPrefix}_rate`;
    const now = Date.now();
    
    if (!req.session[key]) {
      req.session[key] = { windowStart: now, count: 0 };
    }
    
    const rate = req.session[key];
    
    // Reset window if expired
    if (now - rate.windowStart > windowMs) {
      rate.windowStart = now;
      rate.count = 0;
    }
    
    // Check limit
    if (rate.count >= max) {
      return res.status(429).json({ success: false, errors: { general: message }});
    }
    
    rate.count++;
    next();
  };
}

// Pre-configured rate limiters
const chatRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyPrefix: 'chat',
  message: 'Too many messages. Please wait a moment.'
});

const loginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  keyPrefix: 'login',
  message: 'Too many login attempts. Please try again later.'
});

const apiRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyPrefix: 'api',
  message: 'Too many requests. Please slow down.'
});

module.exports = {
  createRateLimiter,
  chatRateLimit,
  loginRateLimit,
  apiRateLimit
};

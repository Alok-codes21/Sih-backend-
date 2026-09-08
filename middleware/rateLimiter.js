import { HTTP_STATUS } from '../utils/constants.js';

/**
 * Creates a rate limiter middleware with periodic stale entry cleanup.
 *
 * @param {Object} options
 * @param {number} [options.windowMs] - Window duration in ms (default: env or 60000).
 * @param {number} [options.max] - Max requests per window (default: env or 100).
 * @param {number} [options.maxRequests] - Alias for max.
 * @returns {Function} Express middleware.
 */
export const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
  const max = options.max || options.maxRequests || parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
  const cache = new Map();

  // Periodic sweep to evict expired IP entries and prevent memory leaks
  const sweepInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of cache) {
      if (now > record.resetTime) {
        cache.delete(ip);
      }
    }
  }, windowMs * 2); // Sweep at 2x the window interval

  // Allow the process to exit cleanly without waiting for the sweep timer
  if (sweepInterval.unref) {
    sweepInterval.unref();
  }

  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    
    if (!cache.has(ip)) {
      cache.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const record = cache.get(ip);
    
    if (now > record.resetTime) {
      cache.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    record.count += 1;
    if (record.count > max) {
      return res.status(HTTP_STATUS.TOO_MANY).json({ error: 'Too many requests, please try again later.' });
    }

    next();
  };
};

/**
 * Stricter rate limiters for authentication-sensitive endpoints.
 * Prevents brute-force attacks on login, registration, and password reset.
 */
export const authRateLimiter = createRateLimiter({ windowMs: 60000, max: 10 });   // 10 req/min
export const loginRateLimiter = createRateLimiter({ windowMs: 60000, max: 5 });   // 5 req/min
export const passwordResetLimiter = createRateLimiter({ windowMs: 60000, max: 3 }); // 3 req/min

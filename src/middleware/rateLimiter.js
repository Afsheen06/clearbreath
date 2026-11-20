import rateLimit from 'express-rate-limit';
import { errorBody } from '../errors.js';

/** Creates the configured API rate limiter.
 * @param {import('../types.js').RateLimitConfig} config Rate limit settings.
 * @returns {import('express').RequestHandler} Rate limit middleware.
 */
export function createRateLimiter(config) {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    limit: config.rateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json(errorBody('rate_limited', 'Too many requests. Please wait a few minutes and try again.')),
  });
}

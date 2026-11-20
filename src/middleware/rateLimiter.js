import rateLimit from 'express-rate-limit';
import { errorBody } from '../errors.js';

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

import compression from 'compression';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { AppError, errorBody } from './errors.js';
import { createPlanRouter } from './routes/plan.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const BODY_LIMIT = '8kb';
const STATIC_MAX_AGE = '1h';

/**
 * Builds the Express app. Dependencies are injected so tests can mock the network.
 * @param {{ config: ReturnType<import('./config.js').loadConfig>, airQuality: object, planner: object, logger?: Console }} deps
 */
export function createApp({ config, airQuality, planner, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          manifestSrc: ["'self'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(compression());

  app.get('/healthz', (_req, res) => res.json({ status: 'ok', aiEnabled: planner.enabled }));

  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    limit: config.rateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json(errorBody('rate_limited', 'Too many requests. Please wait a few minutes and try again.')),
  });

  app.use('/api', limiter, express.json({ limit: BODY_LIMIT }), createPlanRouter({ airQuality, planner, logger }));
  app.use('/api', (_req, _res, next) => next(new AppError(404, 'not_found', 'Unknown API route.')));

  app.use(express.static(PUBLIC_DIR, { maxAge: STATIC_MAX_AGE, index: 'index.html' }));

  app.use((error, _req, res, _next) => {
    if (error instanceof AppError) {
      return res.status(error.status).json(errorBody(error.code, error.message, error.fields));
    }
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json(errorBody('invalid_json', 'The request body is not valid JSON.'));
    }
    if (error?.type === 'entity.too.large') {
      return res.status(413).json(errorBody('payload_too_large', 'The request is too large.'));
    }
    logger.error(`Unhandled error: ${error?.name ?? 'Error'}`);
    return res.status(500).json(errorBody('internal_error', 'Something went wrong on our side. Please try again.'));
  });

  return app;
}

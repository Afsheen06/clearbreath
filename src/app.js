import compression from 'compression';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { AppError } from './errors.js';
import { createPlanRouter } from './routes/plan.js';
import { createErrorHandler } from './middleware/errorHandler.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { securityHeaders } from './middleware/securityHeaders.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const BODY_LIMIT = '8kb';
const STATIC_MAX_AGE = '1h';

/**
 * Builds the Express app from injected dependencies.
 * @param {{ config: import('./types.js').AppConfig, airQuality: import('./types.js').AirQualityService, planner: import('./types.js').PlannerService, logger?: import('./types.js').AppLogger }} deps
 * @returns {import('express').Express} Configured app.
 */
export function createApp({ config, airQuality, planner, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  app.use(securityHeaders());
  app.use(compression());

  app.get('/healthz', (_req, res) => res.json({ status: 'ok', aiEnabled: planner.enabled }));

  app.use('/api', createRateLimiter(config), express.json({ limit: BODY_LIMIT }), createPlanRouter({ airQuality, planner, logger }));
  app.use('/api', unknownApiRoute);

  app.use(
    express.static(PUBLIC_DIR, {
      maxAge: STATIC_MAX_AGE,
      index: 'index.html',
      setHeaders: (res, path) => {
        if (path.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );

  app.use(createErrorHandler(logger));

  return app;
}

function unknownApiRoute(_req, _res, next) {
  next(new AppError(404, 'not_found', 'Unknown API route.'));
}


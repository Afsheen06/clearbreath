import assert from 'node:assert/strict';
import express from 'express';
import { describe, it } from 'node:test';
import { AppError } from '../src/errors.js';
import { createErrorHandler } from '../src/middleware/errorHandler.js';
import { createRateLimiter } from '../src/middleware/rateLimiter.js';
import { securityHeaders } from '../src/middleware/securityHeaders.js';

async function startMiddlewareServer(app) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

describe('securityHeaders', () => {
  it('sets the strict content security policy and referrer policy', async () => {
    const app = express();
    app.use(securityHeaders());
    app.get('/', (_req, res) => res.send('ok'));
    const server = await startMiddlewareServer(app);
    try {
      const response = await fetch(server.url);
      assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    } finally {
      await server.close();
    }
  });
});

describe('createRateLimiter', () => {
  it('returns the established rate-limit error after the configured request count', async () => {
    const app = express();
    app.use(createRateLimiter({ rateLimitWindowMs: 60_000, rateLimitMax: 1 }));
    app.get('/', (_req, res) => res.json({ status: 'ok' }));
    const server = await startMiddlewareServer(app);
    try {
      assert.equal((await fetch(server.url)).status, 200);
      const limited = await fetch(server.url);
      assert.equal(limited.status, 429);
      assert.deepEqual(await limited.json(), {
        error: { code: 'rate_limited', message: 'Too many requests. Please wait a few minutes and try again.' },
      });
    } finally {
      await server.close();
    }
  });
});

describe('createErrorHandler', () => {
  it('maps application errors and hides unexpected error details', async () => {
    const logged = [];
    const app = express();
    app.get('/app-error', (_req, _res, next) =>
      next(new AppError(422, 'invalid_request', 'Please check the fields.', { fields: [{ field: 'city', message: 'Required.' }] })),
    );
    app.get('/unexpected', (_req, _res, next) => next(new Error('private detail')));
    app.use(createErrorHandler({ error: (message) => logged.push(message) }));
    const server = await startMiddlewareServer(app);
    try {
      const applicationError = await fetch(`${server.url}/app-error`);
      assert.equal(applicationError.status, 422);
      assert.deepEqual(await applicationError.json(), {
        error: { code: 'invalid_request', message: 'Please check the fields.', fields: [{ field: 'city', message: 'Required.' }] },
      });

      const unexpected = await fetch(`${server.url}/unexpected`);
      assert.equal(unexpected.status, 500);
      assert.deepEqual(await unexpected.json(), {
        error: { code: 'internal_error', message: 'Something went wrong on our side. Please try again.' },
      });
      assert.deepEqual(logged, ['Unhandled error: Error']);
    } finally {
      await server.close();
    }
  });
});

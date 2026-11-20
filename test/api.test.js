import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { loadConfig } from '../src/config.js';
import { AppError } from '../src/errors.js';
import { makeAir, startTestServer, validPlan } from './helpers.js';

const post = (url, body, init = {}) =>
  fetch(`${url}/api/plan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  });

describe('POST /api/plan (Gemini and Open-Meteo mocked)', () => {
  const state = { planner: null, airError: null };
  let server;

  before(async () => {
    server = await startTestServer({
      airQuality: {
        getAirQuality: async (city, manual) => {
          if (state.airError) throw state.airError;
          return makeAir(manual ?? 320, { place: city });
        },
      },
      planner: {
        get enabled() {
          return state.planner !== null;
        },
        generatePlan: async (input) => state.planner(input),
      },
    });
  });
  after(() => server.close());

  it('returns an AI plan with air data, comparison and disclaimer', async () => {
    state.planner = async () => validPlan;
    const response = await post(server.url, { city: 'Delhi', commute: 'car', commuteKm: 10 });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.mode, 'ai');
    assert.equal(body.air.aqi, 320);
    assert.equal(body.plan.routines[0].title, 'Skip the car');
    assert.ok(body.comparison.reductionPercent > 0);
    assert.match(body.disclaimer, /not medical advice/);
  });

  it('passes the validated profile to the planner', async () => {
    let seen;
    state.planner = async (input) => {
      seen = input;
      return validPlan;
    };
    await post(server.url, { city: 'Patna', household: { elderly: true }, hasPurifier: true });
    assert.equal(seen.profile.city, 'Patna');
    assert.equal(seen.profile.household.elderly, true);
    assert.equal(seen.profile.hasPurifier, true);
  });

  it('falls back to offline guidance when the AI fails', async () => {
    state.planner = async () => {
      throw new AppError(502, 'gemini_error', 'boom');
    };
    const response = await post(server.url, { city: 'Delhi' });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.mode, 'offline');
    assert.ok(body.plan.routines.length > 0);
  });

  it('works in offline mode when no key is configured', async () => {
    state.planner = null;
    const body = await (await post(server.url, { city: 'Delhi', manualAqi: 410 })).json();
    assert.equal(body.mode, 'offline');
    assert.equal(body.air.aqi, 410);
  });

  it('returns field-level errors for invalid input', async () => {
    const response = await post(server.url, { city: '<b>x</b>', manualAqi: 9999 });
    assert.equal(response.status, 400);
    const { error } = await response.json();
    assert.equal(error.code, 'invalid_request');
    assert.deepEqual(error.fields.map((f) => f.field).sort(), ['city', 'manualAqi']);
  });

  it('surfaces air-quality failures without leaking internals', async () => {
    state.airError = new AppError(404, 'city_not_found', 'We could not find "Zzz".');
    const response = await post(server.url, { city: 'Zzz' });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'city_not_found');

    state.airError = new Error('db password is hunter2');
    const crash = await post(server.url, { city: 'Delhi' });
    assert.equal(crash.status, 500);
    const text = await crash.text();
    assert.ok(!text.includes('hunter2'));
    assert.ok(!text.includes('at '));
    state.airError = null;
  });

  it('rejects malformed JSON and oversized bodies', async () => {
    const bad = await post(server.url, '{"city":');
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).error.code, 'invalid_json');

    const big = await post(server.url, { city: 'Delhi', pad: 'x'.repeat(20_000) });
    assert.equal(big.status, 413);
  });

  it('returns 404 JSON for unknown API routes', async () => {
    const response = await fetch(`${server.url}/api/nope`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'not_found');
  });
});

describe('platform behaviour', () => {
  it('serves the UI with strict security headers and hides x-powered-by', async () => {
    const server = await startTestServer();
    try {
      const response = await fetch(`${server.url}/`);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /<h1>/);
      const csp = response.headers.get('content-security-policy');
      assert.match(csp, /default-src 'none'/);
      assert.match(csp, /script-src 'self'/);
      assert.ok(!csp.includes('unsafe-inline'));
      assert.equal(response.headers.get('x-powered-by'), null);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('access-control-allow-origin'), null);
    } finally {
      await server.close();
    }
  });

  it('exposes a health check', async () => {
    const server = await startTestServer();
    try {
      const body = await (await fetch(`${server.url}/healthz`)).json();
      assert.deepEqual(body, { status: 'ok', aiEnabled: false });
    } finally {
      await server.close();
    }
  });

  it('rate limits repeated requests', async () => {
    const server = await startTestServer({ config: loadConfig({ RATE_LIMIT_MAX: '2' }) });
    try {
      const statuses = [];
      for (let i = 0; i < 4; i += 1) statuses.push((await post(server.url, { city: 'Delhi' })).status);
      assert.deepEqual(statuses.slice(0, 2), [200, 200]);
      assert.equal(statuses[3], 429);
    } finally {
      await server.close();
    }
  });
});

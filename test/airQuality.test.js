import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TtlCache, createAirQualityService } from '../src/services/airQuality.js';
import { jsonResponse } from './helpers.js';

const geo = { results: [{ name: 'Delhi', admin1: 'Delhi', country: 'India', latitude: 28.6, longitude: 77.2 }] };
const air = { current: { us_aqi: 312.4, pm2_5: 190.2, pm10: 260, time: '2026-11-19T08:00' } };

function fakeFetch(handlers) {
  const calls = [];
  const impl = async (url) => {
    calls.push(String(url));
    const handler = String(url).includes('geocoding') ? handlers.geo : handlers.air;
    return handler(url);
  };
  impl.calls = calls;
  return impl;
}

const service = (fetchImpl, extra = {}) => createAirQualityService({ fetchImpl, timeoutMs: 1000, cacheTtlMs: 60_000, ...extra });

describe('TtlCache', () => {
  it('expires entries and evicts the oldest at capacity', () => {
    let now = 0;
    const cache = new TtlCache(100, 2, () => now);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.get('c'), 3);
    now = 101;
    assert.equal(cache.get('c'), undefined);
  });
});

describe('createAirQualityService', () => {
  it('geocodes, reads the live AQI and rounds it', async () => {
    const fetchImpl = fakeFetch({ geo: () => jsonResponse(geo), air: () => jsonResponse(air) });
    const result = await service(fetchImpl).getAirQuality('Delhi', null);
    assert.equal(result.aqi, 312);
    assert.equal(result.pm25, 190.2);
    assert.equal(result.place, 'Delhi, Delhi, India');
    assert.equal(result.category.key, 'hazardous');
    assert.equal(result.source, 'live');
    assert.match(fetchImpl.calls[1], /us_aqi/);
  });

  it('caches by city and skips the network on the second call', async () => {
    const fetchImpl = fakeFetch({ geo: () => jsonResponse(geo), air: () => jsonResponse(air) });
    const svc = service(fetchImpl);
    await svc.getAirQuality('Delhi', null);
    const second = await svc.getAirQuality('  delhi'.trim(), null);
    assert.equal(second.source, 'live-cached');
    assert.equal(fetchImpl.calls.length, 2);
  });

  it('uses a manual AQI without any network calls', async () => {
    const fetchImpl = fakeFetch({ geo: () => assert.fail('no network'), air: () => assert.fail('no network') });
    const result = await service(fetchImpl).getAirQuality('Delhi', 180);
    assert.equal(result.source, 'manual');
    assert.equal(result.aqi, 180);
    assert.equal(result.category.key, 'unhealthy');
    assert.equal(fetchImpl.calls.length, 0);
  });

  it('reports an unknown city as 404', async () => {
    const fetchImpl = fakeFetch({ geo: () => jsonResponse({}), air: () => assert.fail('unreachable') });
    await assert.rejects(service(fetchImpl).getAirQuality('Nowhereville', null), { code: 'city_not_found', status: 404 });
  });

  it('maps upstream failures to 502 errors', async () => {
    const down = fakeFetch({ geo: () => { throw new Error('socket'); }, air: () => assert.fail('unreachable') });
    await assert.rejects(service(down).getAirQuality('Delhi', null), { code: 'upstream_unavailable', status: 502 });

    const bad = fakeFetch({ geo: () => jsonResponse(geo), air: () => jsonResponse({}, 500) });
    await assert.rejects(service(bad).getAirQuality('Delhi', null), { code: 'upstream_error' });

    const empty = fakeFetch({ geo: () => jsonResponse(geo), air: () => jsonResponse({ current: {} }) });
    await assert.rejects(service(empty).getAirQuality('Delhi', null), { code: 'upstream_invalid' });

    const garbage = fakeFetch({ geo: () => new Response('<html>', { status: 200 }), air: () => assert.fail('unreachable') });
    await assert.rejects(service(garbage).getAirQuality('Delhi', null), { code: 'upstream_invalid' });
  });

  it('falls back to an AQI-derived PM2.5 when the feed omits it', async () => {
    const fetchImpl = fakeFetch({ geo: () => jsonResponse(geo), air: () => jsonResponse({ current: { us_aqi: 100 } }) });
    const result = await service(fetchImpl).getAirQuality('Delhi', null);
    assert.equal(result.pm25, 35.4);
  });
});

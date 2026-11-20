import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from '../src/config.js';
import {
  AQI_MAX,
  AQI_MIN,
  CITY_MAX_LENGTH,
  CITY_MIN_LENGTH,
  CITY_PATTERN,
  COMMUTE_KM_MAX,
  COMMUTE_KM_MIN,
} from '../src/constants.js';
import { RULES, toPayload, validateForm } from '../public/js/rules.js';

describe('client and server rules stay in step', () => {
  it('shares the same limits and city pattern', () => {
    assert.equal(RULES.cityMin, CITY_MIN_LENGTH);
    assert.equal(RULES.cityMax, CITY_MAX_LENGTH);
    assert.equal(RULES.cityPattern.source, CITY_PATTERN.source);
    assert.equal(RULES.commuteKmMin, COMMUTE_KM_MIN);
    assert.equal(RULES.commuteKmMax, COMMUTE_KM_MAX);
    assert.equal(RULES.aqiMin, AQI_MIN);
    assert.equal(RULES.aqiMax, AQI_MAX);
  });
});

describe('client form rules', () => {
  const ok = { city: 'Delhi', commute: 'car', commuteKm: '10', manualAqi: '' };

  it('accepts a good form and builds a clean payload', () => {
    assert.deepEqual(validateForm(ok), []);
    const payload = toPayload({ ...ok, household: {}, homeType: 'apartment', hasPurifier: false, cookingFuel: 'gas', manualAqi: '250' });
    assert.equal(payload.commuteKm, 10);
    assert.equal(payload.manualAqi, 250);
  });

  it('flags bad values per field', () => {
    const fields = validateForm({ city: '1', commute: 'car', commuteKm: '500', manualAqi: '-4' }).map((e) => e.field);
    assert.deepEqual(fields.sort(), ['city', 'commuteKm', 'manualAqi']);
  });

  it('ignores distance when working from home', () => {
    assert.deepEqual(validateForm({ ...ok, commute: 'wfh', commuteKm: '999' }), []);
    assert.equal('commuteKm' in toPayload({ ...ok, commute: 'wfh', household: {}, homeType: 'apartment', hasPurifier: false, cookingFuel: 'gas' }), false);
  });
});

describe('loadConfig', () => {
  it('applies defaults and ignores junk values', () => {
    const config = loadConfig({ PORT: 'abc', RATE_LIMIT_MAX: '-5', GEMINI_API_KEY: '  key  ' });
    assert.equal(config.port, 3000);
    assert.equal(config.rateLimitMax, 40);
    assert.equal(config.geminiApiKey, 'key');
    assert.equal(config.isProduction, false);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_ITEMS_PER_SECTION, PLAN_JSON_SCHEMA, toGeminiSchema, validatePlan } from '../src/schema.js';
import { validPlan } from './helpers.js';

const clone = () => structuredClone(validPlan);

describe('validatePlan', () => {
  it('accepts a valid plan', () => {
    const result = validatePlan(clone());
    assert.equal(result.ok, true);
    assert.equal(result.value.routines[0].impact.confidence, 'medium');
  });

  it('drops unknown keys so model output cannot smuggle extra data', () => {
    const plan = clone();
    plan.evil = '<img src=x onerror=alert(1)>';
    plan.routines[0].extra = 'x';
    const result = validatePlan(plan);
    assert.equal(result.ok, true);
    assert.equal('evil' in result.value, false);
    assert.equal('extra' in result.value.routines[0], false);
  });

  it('normalises confidence casing and rejects unknown levels', () => {
    const plan = clone();
    plan.routines[0].impact.confidence = 'HIGH';
    assert.equal(validatePlan(plan).value.routines[0].impact.confidence, 'high');
    plan.routines[0].impact.confidence = 'certain';
    assert.equal(validatePlan(plan).ok, false);
  });

  it('truncates long strings and caps list sizes', () => {
    const plan = clone();
    plan.routines[0].title = 'T'.repeat(500);
    plan.indoor = Array.from({ length: 9 }, () => structuredClone(plan.indoor[0]));
    const result = validatePlan(plan);
    assert.equal(result.ok, true);
    assert.ok(result.value.routines[0].title.length <= 80);
    assert.equal(result.value.indoor.length, MAX_ITEMS_PER_SECTION);
  });

  it('reports every structural problem', () => {
    const cases = [
      null,
      'text',
      [],
      {},
      { ...clone(), routines: [] },
      { ...clone(), swaps: 'nope' },
      { ...clone(), healthAlert: { headline: 'x' } },
    ];
    for (const bad of cases) assert.equal(validatePlan(bad).ok, false);
  });

  it('rejects empty strings', () => {
    const plan = clone();
    plan.routines[0].action = '   ';
    assert.equal(validatePlan(plan).ok, false);
  });
});

describe('toGeminiSchema', () => {
  it('uppercases types and strips unsupported keys', () => {
    const converted = toGeminiSchema(PLAN_JSON_SCHEMA);
    assert.equal(converted.type, 'OBJECT');
    assert.equal(converted.properties.routines.type, 'ARRAY');
    assert.equal(converted.properties.routines.items.properties.title.type, 'STRING');
    assert.ok(!JSON.stringify(converted).includes('maxLength'));
    assert.deepEqual(converted.properties.routines.items.properties.impact.properties.confidence.enum, ['low', 'medium', 'high']);
  });
});

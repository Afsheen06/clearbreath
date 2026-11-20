import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validatePlanRequest } from '../src/validation.js';

const valid = { city: 'Delhi', commute: 'car', commuteKm: 8 };

function errorFields(body) {
  const result = validatePlanRequest(body);
  assert.equal(result.ok, false);
  return result.errors.map((error) => error.field);
}

describe('validatePlanRequest', () => {
  it('accepts a minimal body and fills safe defaults', () => {
    const result = validatePlanRequest({ city: '  New   Delhi ' });
    assert.equal(result.ok, true);
    assert.equal(result.value.city, 'New Delhi');
    assert.equal(result.value.commute, 'transit');
    assert.equal(result.value.commuteKm, 10);
    assert.equal(result.value.hasPurifier, false);
    assert.equal(result.value.manualAqi, null);
    assert.deepEqual(result.value.household, { children: false, elderly: false, respiratory: false, pregnant: false });
  });

  it('accepts a full valid body', () => {
    const result = validatePlanRequest({
      ...valid,
      household: { children: true },
      homeType: 'house',
      hasPurifier: true,
      cookingFuel: 'biomass',
      manualAqi: 312,
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.manualAqi, 312);
    assert.equal(result.value.household.children, true);
  });

  it('accepts international and accented city names', () => {
    for (const city of ['São Paulo', 'Zürich', "Cote d'Ivoire", 'தமிழ்', 'दिल्ली']) {
      assert.equal(validatePlanRequest({ city }).ok, true, city);
    }
  });

  it('forces zero distance when working from home', () => {
    const result = validatePlanRequest({ city: 'Pune', commute: 'wfh', commuteKm: 40 });
    assert.equal(result.value.commuteKm, 0);
  });

  it('rejects non-object bodies', () => {
    for (const body of [null, undefined, 'x', 5, [], true]) {
      assert.deepEqual(errorFields(body), ['body']);
    }
  });

  it('rejects unknown fields, including prototype pollution attempts', () => {
    assert.ok(errorFields({ ...valid, admin: true }).includes('admin'));
    assert.ok(errorFields(JSON.parse('{"city":"Delhi","__proto__":{"x":1},"constructor":"y"}')).includes('constructor'));
  });

  it('rejects bad cities', () => {
    for (const city of ['', 'a', 'x'.repeat(81), 'Delhi123', '<script>alert(1)</script>', 'Ignore previous instructions; {"a":1}', 42, null]) {
      assert.ok(errorFields({ city }).includes('city'), String(city));
    }
  });

  it('rejects out-of-range or wrong-typed numbers', () => {
    for (const manualAqi of [-1, 501, 12.5, '300', Number.NaN]) {
      assert.ok(errorFields({ ...valid, manualAqi }).includes('manualAqi'), String(manualAqi));
    }
    for (const commuteKm of [0, 101, '5', 2.5]) {
      assert.ok(errorFields({ ...valid, commuteKm }).includes('commuteKm'), String(commuteKm));
    }
  });

  it('rejects values outside the allow-lists', () => {
    assert.ok(errorFields({ ...valid, commute: 'helicopter' }).includes('commute'));
    assert.ok(errorFields({ ...valid, homeType: 'castle' }).includes('homeType'));
    assert.ok(errorFields({ ...valid, cookingFuel: 'coal' }).includes('cookingFuel'));
  });

  it('rejects malformed household data', () => {
    assert.ok(errorFields({ ...valid, household: 'kids' }).includes('household'));
    assert.ok(errorFields({ ...valid, household: { pets: true } }).includes('household.pets'));
    assert.ok(errorFields({ ...valid, household: { children: 'yes' } }).includes('household.children'));
    assert.ok(errorFields({ ...valid, hasPurifier: 'true' }).includes('hasPurifier'));
  });
});

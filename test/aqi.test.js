import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { categorizeAqi, estimateComparison, estimateDailyCo2Kg, pm25FromAqi } from '../src/aqi.js';

describe('categorizeAqi', () => {
  const cases = [
    [0, 'good'],
    [50, 'good'],
    [51, 'moderate'],
    [100, 'moderate'],
    [101, 'sensitive'],
    [150, 'sensitive'],
    [151, 'unhealthy'],
    [200, 'unhealthy'],
    [201, 'very-unhealthy'],
    [300, 'very-unhealthy'],
    [301, 'hazardous'],
    [500, 'hazardous'],
    [999, 'hazardous'],
  ];
  for (const [aqi, key] of cases) {
    it(`maps AQI ${aqi} to ${key}`, () => assert.equal(categorizeAqi(aqi).key, key));
  }

  it('rejects invalid values', () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => categorizeAqi(bad), RangeError);
    }
  });
});

describe('pm25FromAqi', () => {
  it('hits the EPA breakpoints', () => {
    assert.equal(pm25FromAqi(0), 0);
    assert.equal(pm25FromAqi(50), 9);
    assert.equal(pm25FromAqi(100), 35.4);
    assert.equal(pm25FromAqi(150), 55.4);
    assert.equal(pm25FromAqi(300), 225.4);
  });

  it('is monotonic', () => {
    let previous = -1;
    for (let aqi = 0; aqi <= 500; aqi += 5) {
      const pm = pm25FromAqi(aqi);
      assert.ok(pm >= previous, `PM2.5 dropped at AQI ${aqi}`);
      previous = pm;
    }
  });

  it('caps values above 500', () => assert.equal(pm25FromAqi(800), pm25FromAqi(500)));
});

describe('estimateDailyCo2Kg', () => {
  it('is zero for active travel and work from home', () => {
    assert.equal(estimateDailyCo2Kg('walk', 10), 0);
    assert.equal(estimateDailyCo2Kg('cycle', 10), 0);
    assert.equal(estimateDailyCo2Kg('wfh', 0), 0);
  });

  it('scales with distance for a car', () => {
    assert.equal(estimateDailyCo2Kg('car', 10), 3.4);
    assert.equal(estimateDailyCo2Kg('car', 20), 6.8);
  });
});

describe('estimateComparison', () => {
  const profile = { commute: 'car', commuteKm: 12, hasPurifier: false, cookingFuel: 'gas' };

  it('shows lower exposure and CO2 on a severe day', () => {
    const result = estimateComparison(profile, pm25FromAqi(320), 320);
    assert.ok(result.planExposure < result.baselineExposure);
    assert.ok(result.reductionPercent > 20 && result.reductionPercent <= 100);
    assert.ok(result.co2SavedKg > 0);
    assert.ok(result.assumptions.length >= 4);
  });

  it('never reports a negative saving for low-emission commuters', () => {
    const result = estimateComparison({ ...profile, commute: 'walk' }, 40, 110);
    assert.equal(result.co2SavedKg, 0);
    assert.ok(result.reductionPercent >= 0);
  });

  it('handles work from home without dividing by zero', () => {
    const result = estimateComparison({ ...profile, commute: 'wfh', commuteKm: 0 }, 80, 160);
    assert.ok(Number.isFinite(result.reductionPercent));
    assert.equal(result.baselineCo2Kg, 0);
  });

  it('rewards a purifier and cleaner cooking in the baseline', () => {
    const dirty = estimateComparison({ ...profile, cookingFuel: 'biomass' }, 100, 175);
    const clean = estimateComparison({ ...profile, cookingFuel: 'induction', hasPurifier: true }, 100, 175);
    assert.ok(clean.baselineExposure < dirty.baselineExposure);
  });

  it('rejects an invalid AQI', () => assert.throws(() => estimateComparison(profile, 10, -5), RangeError));
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validatePlan } from '../src/schema.js';
import { buildFallbackPlan } from '../src/services/fallbackPlanner.js';
import { baseProfile, makeAir } from './helpers.js';

const households = [
  { children: false, elderly: false, respiratory: false, pregnant: false },
  { children: true, elderly: true, respiratory: true, pregnant: true },
];
const commutes = ['walk', 'cycle', 'two_wheeler', 'car', 'transit', 'wfh'];
const fuels = ['gas', 'induction', 'biomass'];
const aqis = [20, 90, 130, 180, 260, 420];

describe('buildFallbackPlan', () => {
  it('always produces a plan that passes the shared schema', () => {
    for (const household of households) {
      for (const commute of commutes) {
        for (const cookingFuel of fuels) {
          for (const aqi of aqis) {
            for (const hasPurifier of [true, false]) {
              const profile = { ...baseProfile, household, commute, cookingFuel, hasPurifier, commuteKm: commute === 'wfh' ? 0 : 7 };
              const plan = buildFallbackPlan({ profile, air: makeAir(aqi) });
              const result = validatePlan(plan);
              assert.equal(result.ok, true, `${commute}/${cookingFuel}/${aqi}: ${result.errors?.join('; ')}`);
            }
          }
        }
      }
    }
  });

  it('adds protective advice only when the air is unhealthy', () => {
    const clean = buildFallbackPlan({ profile: baseProfile, air: makeAir(30) });
    const smoggy = buildFallbackPlan({ profile: baseProfile, air: makeAir(320) });
    const titles = (plan) => plan.routines.map((entry) => entry.title).join(' | ');
    assert.ok(!/N95/.test(titles(clean)));
    assert.ok(/N95/.test(titles(smoggy)));
  });

  it('tailors indoor advice to the household and equipment', () => {
    const withPurifier = buildFallbackPlan({ profile: { ...baseProfile, hasPurifier: true }, air: makeAir(250) });
    const without = buildFallbackPlan({ profile: { ...baseProfile, hasPurifier: false }, air: makeAir(250) });
    assert.ok(withPurifier.indoor.some((entry) => /purifier/i.test(entry.title)));
    assert.ok(without.indoor.some((entry) => /DIY/i.test(entry.title)));

    const biomass = buildFallbackPlan({ profile: { ...baseProfile, cookingFuel: 'biomass' }, air: makeAir(250) });
    assert.ok(biomass.indoor.some((entry) => /cleaner heat/i.test(entry.title)));
  });

  it('names who is at risk', () => {
    const plan = buildFallbackPlan({ profile: baseProfile, air: makeAir(250) });
    assert.ok(plan.healthAlert.atRisk.includes('Children'));
    assert.match(plan.healthAlert.headline, /250/);
  });

  it('keeps every section within four items', () => {
    const plan = buildFallbackPlan({ profile: { ...baseProfile, household: households[1] }, air: makeAir(400) });
    for (const key of ['routines', 'indoor', 'swaps']) assert.ok(plan[key].length <= 4);
  });
});

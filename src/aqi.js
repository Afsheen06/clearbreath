/**
 * Pure helpers: AQI categories, AQI to PM2.5 conversion, and a deliberately simple,
 * transparent model that compares a day "as usual" with a day following the plan.
 * All numbers are illustrative estimates and are labelled as such in the UI.
 */

export const AQI_CATEGORIES = Object.freeze([
  { key: 'good', maxAqi: 50, label: 'Good', icon: '●', guidance: 'Air quality is satisfactory. Enjoy your usual outdoor routine.' },
  { key: 'moderate', maxAqi: 100, label: 'Moderate', icon: '◆', guidance: 'Air quality is acceptable, though unusually sensitive people may notice symptoms.' },
  { key: 'sensitive', maxAqi: 150, label: 'Unhealthy for sensitive groups', icon: '▲', guidance: 'Children, older adults and people with breathing conditions should limit long or intense time outdoors.' },
  { key: 'unhealthy', maxAqi: 200, label: 'Unhealthy', icon: '■', guidance: 'Everyone may begin to feel effects. Cut back on prolonged outdoor exertion.' },
  { key: 'very-unhealthy', maxAqi: 300, label: 'Very unhealthy', icon: '✚', guidance: 'Health alert: avoid outdoor exertion and keep indoor air as clean as you can.' },
  { key: 'hazardous', maxAqi: Number.POSITIVE_INFINITY, label: 'Hazardous', icon: '✖', guidance: 'Emergency conditions: stay indoors with clean air and go out only when essential.' },
]);

/** AQI at which protective actions (mask, off-peak timing, sealed home) start to matter. */
export const PROTECTIVE_ACTION_AQI = 101;
/** AQI at which outdoor exercise should move indoors. */
export const SEVERE_AQI = 151;

/** US EPA PM2.5 breakpoints (24-hour, 2024 revision) used to approximate PM2.5 from a manual AQI. */
const PM25_BREAKPOINTS = Object.freeze([
  { aqiLow: 0, aqiHigh: 50, pmLow: 0, pmHigh: 9.0 },
  { aqiLow: 51, aqiHigh: 100, pmLow: 9.1, pmHigh: 35.4 },
  { aqiLow: 101, aqiHigh: 150, pmLow: 35.5, pmHigh: 55.4 },
  { aqiLow: 151, aqiHigh: 200, pmLow: 55.5, pmHigh: 125.4 },
  { aqiLow: 201, aqiHigh: 300, pmLow: 125.5, pmHigh: 225.4 },
  { aqiLow: 301, aqiHigh: 500, pmLow: 225.5, pmHigh: 325.4 },
]);

/**
 * Commute estimates: `outdoorFactor` is ambient PM2.5 reaching a traveller,
 * `kgCo2PerKm` is per-passenger tailpipe CO2, and `hoursPerKm` is urban travel time.
 */
export const COMMUTE_MODES = Object.freeze({
  walk: { label: 'walking', outdoorFactor: 1, kgCo2PerKm: 0, hoursPerKm: 0.2 },
  cycle: { label: 'cycling', outdoorFactor: 1.1, kgCo2PerKm: 0, hoursPerKm: 1 / 15 },
  two_wheeler: { label: 'a two-wheeler', outdoorFactor: 1, kgCo2PerKm: 0.04, hoursPerKm: 1 / 25 },
  car: { label: 'a car', outdoorFactor: 0.5, kgCo2PerKm: 0.17, hoursPerKm: 1 / 20 },
  transit: { label: 'public transit', outdoorFactor: 0.7, kgCo2PerKm: 0.03, hoursPerKm: 1 / 20 },
  wfh: { label: 'working from home', outdoorFactor: 0, kgCo2PerKm: 0, hoursPerKm: 0 },
});
export const COMMUTE_MODE_KEYS = Object.freeze(Object.keys(COMMUTE_MODES));

const HOURS_PER_DAY = 24;
const ERRAND_HOURS = 1;
const MASK_OUTDOOR_FACTOR = 0.5;
const OFF_PEAK_FACTOR = 0.85;
const INDOOR_FACTOR = Object.freeze({
  baseline: { withPurifier: 0.5, withoutPurifier: 0.8 },
  plan: { withPurifier: 0.3, withoutPurifier: 0.55 },
});
const COOKING_INDOOR_PENALTY = Object.freeze({ gas: 0.05, induction: 0, biomass: 0.2 });
const PLAN_COOKING_PENALTY_SHARE = 0.5;
const SWAPPED_TO_TRANSIT = new Set(['car', 'two_wheeler']);

/**
 * Rounds a numeric value to a fixed number of decimal places.
 * @param {number} value Number to round.
 * @param {number} [digits=1] Decimal places to retain.
 * @returns {number} Rounded value.
 */
export function roundTo(value, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function assertAqi(aqi) {
  if (!Number.isFinite(aqi) || aqi < 0) {
    throw new RangeError('AQI must be a finite, non-negative number.');
  }
}

/**
 * Returns the category for a US AQI value.
 * @param {number} aqi US AQI value.
 * @returns {object} The matching AQI category.
 */
export function categorizeAqi(aqi) {
  assertAqi(aqi);
  return AQI_CATEGORIES.find((category) => aqi <= category.maxAqi);
}

/**
 * Approximates PM2.5 (µg/m³) from a US AQI using EPA breakpoints.
 * @param {number} aqi US AQI value.
 * @returns {number} Estimated PM2.5 concentration in µg/m³.
 */
export function pm25FromAqi(aqi) {
  assertAqi(aqi);
  const clamped = Math.min(aqi, 500);
  const band = PM25_BREAKPOINTS.find((b) => clamped <= b.aqiHigh) ?? PM25_BREAKPOINTS.at(-1);
  const span = band.aqiHigh - band.aqiLow;
  const progress = (clamped - band.aqiLow) / span;
  return roundTo(band.pmLow + progress * (band.pmHigh - band.pmLow), 1);
}

/**
 * Estimates round-trip tailpipe CO2 for a commute.
 * @param {string} mode Commute mode key.
 * @param {number} oneWayKm One-way commute distance in kilometres.
 * @returns {number} Estimated kilograms of CO2 per round trip.
 */
export function estimateDailyCo2Kg(mode, oneWayKm) {
  const config = COMMUTE_MODES[mode];
  return roundTo(2 * oneWayKm * config.kgCo2PerKm, 2);
}

function indoorFactor(table, profile, penaltyShare) {
  const base = profile.hasPurifier ? table.withPurifier : table.withoutPurifier;
  return Math.min(1, base + COOKING_INDOOR_PENALTY[profile.cookingFuel] * penaltyShare);
}

function dailyExposure({ pm25, mode, oneWayKm, outdoorMultiplier, indoor }) {
  const config = COMMUTE_MODES[mode];
  const commuteHours = mode === 'wfh' ? 0 : 2 * oneWayKm * config.hoursPerKm;
  const commute = pm25 * commuteHours * config.outdoorFactor * outdoorMultiplier;
  const errands = pm25 * ERRAND_HOURS * outdoorMultiplier;
  const indoorHours = HOURS_PER_DAY - commuteHours - ERRAND_HOURS;
  return commute + errands + pm25 * indoorHours * indoor;
}

function planCommuteMode(commute) {
  return SWAPPED_TO_TRANSIT.has(commute) ? 'transit' : commute;
}

function computeBaselineExposure(profile, pm25) {
  return dailyExposure({
    pm25,
    mode: profile.commute,
    oneWayKm: profile.commuteKm,
    outdoorMultiplier: 1,
    indoor: indoorFactor(INDOOR_FACTOR.baseline, profile, 1),
  });
}

function computePlanExposure(profile, pm25, protective) {
  return dailyExposure({
    pm25,
    mode: planCommuteMode(profile.commute),
    oneWayKm: profile.commuteKm,
    outdoorMultiplier: protective ? MASK_OUTDOOR_FACTOR * OFF_PEAK_FACTOR : 1,
    indoor: indoorFactor(INDOOR_FACTOR.plan, profile, PLAN_COOKING_PENALTY_SHARE),
  });
}

function buildAssumptions(profile, _protective) {
  // The mask assumption describes the model's AQI threshold, so it stays visible at every AQI.
  return [
    'Exposure is a time-weighted PM2.5 total over 24 hours (µg·h/m³) built from simple, fixed assumptions.',
    profile.commute === 'wfh'
      ? 'You work from home, so no commute exposure or emissions are counted.'
      : `Your commute is ${profile.commuteKm} km each way by ${COMMUTE_MODES[profile.commute].label}.`,
    `About ${ERRAND_HOURS} hour of errands outdoors per day.`,
    'Indoor air follows outdoor air, scaled down by your home set-up; the plan assumes closed windows, a purifier or DIY filter and cleaner cooking.',
    `On AQI ${PROTECTIVE_ACTION_AQI}+ days the plan assumes a well-fitted N95 mask and off-peak timing for outdoor time (real-world fit varies).`,
    ...(SWAPPED_TO_TRANSIT.has(profile.commute) ? ['The plan assumes you switch solo trips to public transit.'] : []),
    'These are illustrative estimates, not medical or regulatory figures.',
  ];
}

/**
 * Compares estimated exposure and commute emissions for a usual day and planned day.
 * @param {{ commute: string, commuteKm: number, hasPurifier: boolean, cookingFuel: string }} profile Household and commute profile.
 * @param {number} pm25 Ambient PM2.5 in µg/m³.
 * @param {number} aqi US AQI value.
 * @returns {object} Exposure, emissions, savings, and assumptions.
 */
export function estimateComparison(profile, pm25, aqi) {
  assertAqi(aqi);
  const protective = aqi >= PROTECTIVE_ACTION_AQI;
  const planMode = planCommuteMode(profile.commute);
  const baselineExposure = computeBaselineExposure(profile, pm25);
  const planExposure = computePlanExposure(profile, pm25, protective);
  const baselineCo2Kg = estimateDailyCo2Kg(profile.commute, profile.commuteKm);
  const planCo2Kg = estimateDailyCo2Kg(planMode, profile.commuteKm);
  const reduction = baselineExposure > 0 ? 1 - planExposure / baselineExposure : 0;

  return {
    baselineExposure: roundTo(baselineExposure, 0),
    planExposure: roundTo(planExposure, 0),
    reductionPercent: Math.max(0, Math.min(100, Math.round(reduction * 100))),
    baselineCo2Kg,
    planCo2Kg,
    co2SavedKg: roundTo(Math.max(0, baselineCo2Kg - planCo2Kg), 2),
    assumptions: buildAssumptions(profile, protective),
  };
}

/**
 * Client-side input rules. These give instant feedback only; the server re-validates everything.
 * Keep in step with src/constants.js (test/parity.test.js enforces this).
 */
export const RULES = Object.freeze({
  cityMin: 2,
  cityMax: 80,
  cityPattern: /^[\p{L}\p{M}][\p{L}\p{M}\s.,'’()-]*$/u,
  commuteKmMin: 1,
  commuteKmMax: 100,
  aqiMin: 0,
  aqiMax: 500,
});

/**
 * @param {import('../../src/types.js').FormValues} values Raw form values.
 * @returns {import('../../src/types.js').FieldError[]} Validation errors.
 */
export function validateForm(values) {
  const errors = [];
  const city = values.city.replace(/\s+/g, ' ').trim();

  if (city.length < RULES.cityMin || city.length > RULES.cityMax) {
    errors.push({ field: 'city', message: `Enter a city name (${RULES.cityMin}-${RULES.cityMax} characters).` });
  } else if (!RULES.cityPattern.test(city)) {
    errors.push({ field: 'city', message: 'Use letters and spaces only for the city name.' });
  }
  errors.push(...validateCommute(values), ...validateManualAqi(values));
  return errors;
}

function validateCommute(values) {
  if (values.commute === 'wfh' || values.commuteKm === '') return [];
  const km = Number(values.commuteKm);
  if (Number.isInteger(km) && km >= RULES.commuteKmMin && km <= RULES.commuteKmMax) return [];
  return [{ field: 'commuteKm', message: `Enter a whole number from ${RULES.commuteKmMin} to ${RULES.commuteKmMax}.` }];
}

function validateManualAqi(values) {
  if (values.manualAqi === '') return [];
  const aqi = Number(values.manualAqi);
  if (Number.isInteger(aqi) && aqi >= RULES.aqiMin && aqi <= RULES.aqiMax) return [];
  return [{ field: 'manualAqi', message: `Enter a whole number from ${RULES.aqiMin} to ${RULES.aqiMax}.` }];
}

/** Builds an API payload from validated form values.
 * @param {import('../../src/types.js').FormValues} values Validated form values.
 * @returns {import('../../src/types.js').PlanRequest} API request body.
 */
export function toPayload(values) {
  const payload = {
    city: values.city.replace(/\s+/g, ' ').trim(),
    household: values.household,
    commute: values.commute,
    homeType: values.homeType,
    hasPurifier: values.hasPurifier,
    cookingFuel: values.cookingFuel,
  };
  if (values.commute !== 'wfh' && values.commuteKm !== '') payload.commuteKm = Number(values.commuteKm);
  if (values.manualAqi !== '') payload.manualAqi = Number(values.manualAqi);
  return payload;
}

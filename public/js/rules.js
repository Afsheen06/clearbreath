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
 * @param {{ city: string, commute: string, commuteKm: string, manualAqi: string }} values raw form strings
 * @returns {Array<{ field: string, message: string }>}
 */
export function validateForm(values) {
  const errors = [];
  const city = values.city.replace(/\s+/g, ' ').trim();

  if (city.length < RULES.cityMin || city.length > RULES.cityMax) {
    errors.push({ field: 'city', message: `Enter a city name (${RULES.cityMin}-${RULES.cityMax} characters).` });
  } else if (!RULES.cityPattern.test(city)) {
    errors.push({ field: 'city', message: 'Use letters and spaces only for the city name.' });
  }

  if (values.commute !== 'wfh') {
    const km = Number(values.commuteKm);
    if (values.commuteKm !== '' && !(Number.isInteger(km) && km >= RULES.commuteKmMin && km <= RULES.commuteKmMax)) {
      errors.push({ field: 'commuteKm', message: `Enter a whole number from ${RULES.commuteKmMin} to ${RULES.commuteKmMax}.` });
    }
  }

  if (values.manualAqi !== '') {
    const aqi = Number(values.manualAqi);
    if (!(Number.isInteger(aqi) && aqi >= RULES.aqiMin && aqi <= RULES.aqiMax)) {
      errors.push({ field: 'manualAqi', message: `Enter a whole number from ${RULES.aqiMin} to ${RULES.aqiMax}.` });
    }
  }
  return errors;
}

/** Builds the API payload from raw form values (already validated). */
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

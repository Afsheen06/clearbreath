import { COMMUTE_MODE_KEYS } from './aqi.js';
import {
  AQI_MAX,
  AQI_MIN,
  CITY_MAX_LENGTH,
  CITY_MIN_LENGTH,
  CITY_PATTERN,
  COMMUTE_KM_MAX,
  COMMUTE_KM_MIN,
  COOKING_FUELS,
  DEFAULT_COMMUTE_KM,
  HOME_TYPES,
  HOUSEHOLD_FLAGS,
} from './constants.js';

const ALLOWED_FIELDS = new Set([
  'city',
  'household',
  'commute',
  'commuteKm',
  'homeType',
  'hasPurifier',
  'cookingFuel',
  'manualAqi',
]);

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function readCity(raw, fail) {
  if (typeof raw !== 'string') {
    fail('city', 'City is required.');
    return '';
  }
  const city = raw.replace(/\s+/g, ' ').trim();
  if (city.length < CITY_MIN_LENGTH || city.length > CITY_MAX_LENGTH) {
    fail('city', `City must be ${CITY_MIN_LENGTH}-${CITY_MAX_LENGTH} characters.`);
  } else if (!CITY_PATTERN.test(city)) {
    fail('city', 'City may only contain letters, spaces and common punctuation.');
  }
  return city;
}

function readBoolean(field, raw, fallback, fail) {
  if (raw === undefined) return fallback;
  if (typeof raw === 'boolean') return raw;
  fail(field, 'Must be true or false.');
  return fallback;
}

function readEnum(field, raw, allowed, fallback, fail) {
  if (raw === undefined) return fallback;
  if (typeof raw === 'string' && allowed.includes(raw)) return raw;
  fail(field, `Must be one of: ${allowed.join(', ')}.`);
  return fallback;
}

function readNumber(field, raw, { min, max, integer = false }, fail) {
  if (raw === undefined || raw === null) return null;
  const valid =
    typeof raw === 'number' && Number.isFinite(raw) && raw >= min && raw <= max && (!integer || Number.isInteger(raw));
  if (valid) return raw;
  fail(field, `Must be ${integer ? 'a whole number' : 'a number'} from ${min} to ${max}.`);
  return null;
}

function readHousehold(raw, fail) {
  const household = Object.fromEntries(HOUSEHOLD_FLAGS.map((flag) => [flag, false]));
  if (raw === undefined) return household;
  if (!isPlainObject(raw)) {
    fail('household', 'Must be an object.');
    return household;
  }
  for (const key of Object.keys(raw)) {
    if (!HOUSEHOLD_FLAGS.includes(key)) fail(`household.${key}`, 'Unknown field.');
  }
  for (const flag of HOUSEHOLD_FLAGS) {
    household[flag] = readBoolean(`household.${flag}`, raw[flag], false, fail);
  }
  return household;
}

/**
 * Validates and normalises an untrusted /api/plan request body.
 * @param {unknown} body
 * @returns {{ ok: true, value: import('./types.js').Profile } | { ok: false, errors: import('./types.js').FieldError[] }}
 */
export function validatePlanRequest(body) {
  if (!isPlainObject(body)) {
    return { ok: false, errors: [{ field: 'body', message: 'Request body must be a JSON object.' }] };
  }

  const errors = [];
  const fail = (field, message) => errors.push({ field, message });

  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) fail(key, 'Unknown field.');
  }

  const commute = readEnum('commute', body.commute, COMMUTE_MODE_KEYS, 'transit', fail);
  const requestedKm = readNumber('commuteKm', body.commuteKm, { min: COMMUTE_KM_MIN, max: COMMUTE_KM_MAX, integer: true }, fail);

  const value = {
    city: readCity(body.city, fail),
    household: readHousehold(body.household, fail),
    commute,
    commuteKm: commute === 'wfh' ? 0 : (requestedKm ?? DEFAULT_COMMUTE_KM),
    homeType: readEnum('homeType', body.homeType, HOME_TYPES, 'apartment', fail),
    hasPurifier: readBoolean('hasPurifier', body.hasPurifier, false, fail),
    cookingFuel: readEnum('cookingFuel', body.cookingFuel, COOKING_FUELS, 'gas', fail),
    manualAqi: readNumber('manualAqi', body.manualAqi, { min: AQI_MIN, max: AQI_MAX, integer: true }, fail),
  };

  return errors.length ? { ok: false, errors } : { ok: true, value };
}

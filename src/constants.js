/** Shared limits and enumerations. Client-side rules in public/js/rules.js mirror these (a test checks parity). */

export const HOME_TYPES = Object.freeze(['apartment', 'house']);
export const COOKING_FUELS = Object.freeze(['gas', 'induction', 'biomass']);
export const HOUSEHOLD_FLAGS = Object.freeze(['children', 'elderly', 'respiratory', 'pregnant']);

export const CITY_MIN_LENGTH = 2;
export const CITY_MAX_LENGTH = 80;
/** Letters (any script), combining marks, spaces and light punctuation only. No digits, no markup characters. */
export const CITY_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s.,'’()-]*$/u;

export const COMMUTE_KM_MIN = 1;
export const COMMUTE_KM_MAX = 100;
export const DEFAULT_COMMUTE_KM = 10;

export const AQI_MIN = 0;
export const AQI_MAX = 500;

export const DISCLAIMER =
  'Clearbreath offers general wellbeing guidance and illustrative estimates, not medical advice. ' +
  'If you or a family member has symptoms such as chest tightness, wheezing or breathlessness, please contact a doctor.';

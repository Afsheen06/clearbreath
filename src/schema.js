/**
 * Single source of truth for the shape of a plan. The same definition drives the
 * Gemini response schema, server-side validation and the browser renderer.
 */

export const MAX_ITEMS_PER_SECTION = 4;
export const CONFIDENCE_LEVELS = Object.freeze(['low', 'medium', 'high']);

const text = (maxLength) => ({ type: 'string', maxLength });

const ITEM_SCHEMA = {
  type: 'object',
  properties: {
    title: text(80),
    action: text(320),
    why: text(320),
    bestTime: text(80),
    impact: {
      type: 'object',
      properties: {
        estimate: text(180),
        confidence: { type: 'string', enum: CONFIDENCE_LEVELS },
      },
      required: ['estimate', 'confidence'],
    },
  },
  required: ['title', 'action', 'why', 'impact'],
};

const section = { type: 'array', items: ITEM_SCHEMA, minItems: 1, maxItems: MAX_ITEMS_PER_SECTION };

export const PLAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    healthAlert: {
      type: 'object',
      properties: {
        headline: text(160),
        summary: text(420),
        atRisk: { type: 'array', items: text(80), maxItems: 4 },
      },
      required: ['headline', 'summary', 'atRisk'],
    },
    routines: section,
    indoor: section,
    swaps: section,
  },
  required: ['healthAlert', 'routines', 'indoor', 'swaps'],
};

function ellipsize(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;
}

function checkString(schema, value, path, errors) {
  if (typeof value !== 'string') {
    errors.push(`${path}: expected text`);
    return undefined;
  }
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    errors.push(`${path}: must not be empty`);
    return undefined;
  }
  if (schema.enum) {
    const lowered = cleaned.toLowerCase();
    if (!schema.enum.includes(lowered)) {
      errors.push(`${path}: must be one of ${schema.enum.join(', ')}`);
      return undefined;
    }
    return lowered;
  }
  return schema.maxLength ? ellipsize(cleaned, schema.maxLength) : cleaned;
}

function checkArray(schema, value, path, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${path}: expected a list`);
    return undefined;
  }
  if (schema.minItems && value.length < schema.minItems) {
    errors.push(`${path}: needs at least ${schema.minItems} item(s)`);
    return undefined;
  }
  const limited = schema.maxItems ? value.slice(0, schema.maxItems) : value;
  return limited
    .map((entry, index) => checkValue(schema.items, entry, `${path}[${index}]`, errors))
    .filter((entry) => entry !== undefined);
}

function checkObject(schema, value, path, errors) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(`${path}: expected an object`);
    return undefined;
  }
  const out = {};
  for (const [key, propertySchema] of Object.entries(schema.properties)) {
    const required = schema.required?.includes(key);
    const raw = Object.hasOwn(value, key) ? value[key] : undefined;
    if (shouldSkipObjectValue(raw, required)) {
      if (required) errors.push(`${path}.${key}: is required`);
      continue;
    }
    const child = checkValue(propertySchema, raw, `${path}.${key}`, errors);
    if (child !== undefined) out[key] = child;
  }
  return out;
}

function shouldSkipObjectValue(raw, required) {
  return raw === undefined || raw === null || (!required && typeof raw === 'string' && raw.trim() === '');
}

const CHECKERS = new Map([
  ['string', checkString],
  ['array', checkArray],
  ['object', checkObject],
]);

/** Validates against a schema and returns a sanitised copy (unknown keys dropped, long text trimmed). */
function checkValue(schema, value, path, errors) {
  const checker = CHECKERS.get(schema.type);
  if (!checker) throw new Error(`Unsupported schema type: ${schema.type}`);
  return checker(schema, value, path, errors);
}

/** Validates and normalizes untrusted model output.
 * @param {unknown} raw Model output after JSON parsing.
 * @returns {{ ok: true, value: import('./types.js').Plan } | { ok: false, errors: string[] }} Validation result.
 */
export function validatePlan(raw) {
  const errors = [];
  const value = checkValue(PLAN_JSON_SCHEMA, raw, 'plan', errors);
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

const GEMINI_UNSUPPORTED_KEYS = new Set(['maxLength', 'additionalProperties', '$schema']);

/** Converts the local schema to the dialect accepted by Gemini's responseSchema.
 * @param {object} schema Local JSON schema.
 * @returns {object} Gemini-compatible schema.
 */
export function toGeminiSchema(schema) {
  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (GEMINI_UNSUPPORTED_KEYS.has(key)) continue;
    if (key === 'type') out.type = value.toUpperCase();
    else if (key === 'items') out.items = toGeminiSchema(value);
    else if (key === 'properties') {
      out.properties = Object.fromEntries(
        Object.entries(value).map(([name, child]) => [name, toGeminiSchema(child)]),
      );
    } else out[key] = value;
  }
  return out;
}

import { AppError } from '../errors.js';
import { categorizeAqi, pm25FromAqi } from '../aqi.js';

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const MAX_CACHE_ENTRIES = 200;

/** Small TTL cache with a size cap (oldest entry evicted first). */
export class TtlCache {
  /** Creates a size-limited time-to-live cache.
   * @param {number} ttlMs Entry lifetime in milliseconds.
   * @param {number} [maxEntries] Maximum stored entries.
   * @param {() => number} [now] Clock used for expiry checks.
   */
  constructor(ttlMs, maxEntries = MAX_CACHE_ENTRIES, now = () => Date.now()) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
    this.entries = new Map();
  }

  get(key) {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (this.now() - hit.storedAt > this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key, value) {
    if (this.entries.size >= this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value);
    }
    this.entries.set(key, { value, storedAt: this.now() });
  }
}

async function getJson(fetchImpl, url, timeoutMs, label) {
  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
  } catch (cause) {
    throw new AppError(502, 'upstream_unavailable', `${label} is not reachable right now.`, { cause });
  }
  if (!response.ok) {
    throw new AppError(502, 'upstream_error', `${label} returned an error (${response.status}).`);
  }
  try {
    return await response.json();
  } catch (cause) {
    throw new AppError(502, 'upstream_invalid', `${label} sent an unreadable response.`, { cause });
  }
}

const finiteOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * Creates an air-quality service. `fetchImpl` can replace network access.
 * @param {{ fetchImpl?: typeof fetch, timeoutMs: number, cacheTtlMs: number, now?: () => number }} options
 * @returns {{ getAirQuality(city: string, manualAqi: number|null): Promise<import('../types.js').AirReading> }} Air-quality service.
 */
export function createAirQualityService({ fetchImpl = fetch, timeoutMs, cacheTtlMs, now }) {
  const cache = new TtlCache(cacheTtlMs, MAX_CACHE_ENTRIES, now);

  async function geocode(city) {
    const url = `${GEOCODE_URL}?${new URLSearchParams({ name: city, count: '1', language: 'en', format: 'json' })}`;
    const data = await getJson(fetchImpl, url, timeoutMs, 'The location service');
    const match = data?.results?.[0];
    if (!match || !Number.isFinite(match.latitude) || !Number.isFinite(match.longitude)) {
      throw new AppError(404, 'city_not_found', `We could not find "${city}". Check the spelling or try a nearby larger city.`);
    }
    return {
      name: [match.name, match.admin1, match.country].filter(Boolean).join(', '),
      latitude: match.latitude,
      longitude: match.longitude,
    };
  }

  async function fetchCurrent({ latitude, longitude }) {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: 'us_aqi,pm2_5,pm10',
      timezone: 'auto',
    });
    const data = await getJson(fetchImpl, `${AIR_URL}?${params}`, timeoutMs, 'The air-quality service');
    const aqi = finiteOrNull(data?.current?.us_aqi);
    if (aqi === null) {
      throw new AppError(502, 'upstream_invalid', 'The air-quality service had no reading for this location.');
    }
    return {
      aqi: Math.round(aqi),
      pm25: finiteOrNull(data.current.pm2_5) ?? pm25FromAqi(aqi),
      pm10: finiteOrNull(data.current.pm10),
      observedAt: typeof data.current.time === 'string' ? data.current.time : null,
    };
  }

  /**
   * Resolves a city to an air-quality reading. A manual AQI skips the live air fetch
   * but still tries geocoding so the plan can name the place properly.
   * @param {string} city
   * @param {number | null} manualAqi
   */
  async function getAirQuality(city, manualAqi) {
    if (manualAqi !== null) {
      const aqi = manualAqi;
      return {
        place: city,
        aqi,
        pm25: pm25FromAqi(aqi),
        pm10: null,
        observedAt: null,
        category: categorizeAqi(aqi),
        source: 'manual',
      };
    }

    const key = city.toLowerCase();
    const cached = cache.get(key);
    if (cached) return { ...cached, source: 'live-cached' };

    const place = await geocode(city);
    const current = await fetchCurrent(place);
    const reading = {
      place: place.name,
      ...current,
      category: categorizeAqi(current.aqi),
    };
    cache.set(key, reading);
    return { ...reading, source: 'live' };
  }

  return { getAirQuality };
}

const MINUTE_MS = 60 * 1000;

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Reads runtime configuration from environment variables with safe defaults.
 * @param {Record<string, string | undefined>} [env]
 * @returns {Readonly<import('./types.js').AppConfig>} Frozen settings.
 */
export function loadConfig(env = process.env) {
  return Object.freeze({
    isProduction: env.NODE_ENV === 'production',
    port: positiveInt(env.PORT, 3000),
    geminiApiKey: env.GEMINI_API_KEY?.trim() || '',
    geminiModel: env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
    geminiTimeoutMs: positiveInt(env.GEMINI_TIMEOUT_MS, 8_000),
    upstreamTimeoutMs: positiveInt(env.UPSTREAM_TIMEOUT_MS, 5_000),
    cacheTtlMs: positiveInt(env.AIR_CACHE_TTL_MS, 10 * MINUTE_MS),
    rateLimitWindowMs: positiveInt(env.RATE_LIMIT_WINDOW_MS, 15 * MINUTE_MS),
    rateLimitMax: positiveInt(env.RATE_LIMIT_MAX, 40),
    trustProxy: positiveInt(env.TRUST_PROXY, 0),
  });
}

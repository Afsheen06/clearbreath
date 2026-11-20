import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createAirQualityService } from './services/airQuality.js';
import { createGeminiPlanner } from './services/gemini.js';

const config = loadConfig();

const app = createApp({
  config,
  airQuality: createAirQualityService({ timeoutMs: config.upstreamTimeoutMs, cacheTtlMs: config.cacheTtlMs }),
  planner: createGeminiPlanner({
    apiKey: config.geminiApiKey,
    model: config.geminiModel,
    timeoutMs: config.geminiTimeoutMs,
  }),
});

const server = app.listen(config.port, () => {
  const mode = config.geminiApiKey ? 'Gemini enabled' : 'offline guidance mode (no GEMINI_API_KEY)';
  console.log(`Clearbreath listening on http://localhost:${config.port} (${mode})`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

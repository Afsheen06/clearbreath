import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { categorizeAqi, pm25FromAqi } from '../src/aqi.js';

export const silentLogger = { warn() {}, error() {}, log() {} };

export const baseProfile = Object.freeze({
  city: 'Delhi',
  household: { children: true, elderly: false, respiratory: true, pregnant: false },
  commute: 'car',
  commuteKm: 12,
  homeType: 'apartment',
  hasPurifier: false,
  cookingFuel: 'gas',
  manualAqi: null,
});

export function makeAir(aqi = 320, overrides = {}) {
  return {
    place: 'Delhi, India',
    aqi,
    pm25: pm25FromAqi(aqi),
    pm10: null,
    observedAt: null,
    category: categorizeAqi(aqi),
    source: 'live',
    ...overrides,
  };
}

export const validPlan = Object.freeze({
  healthAlert: { headline: 'Very unhealthy air', summary: 'Stay indoors where you can.', atRisk: ['Children'] },
  routines: [{ title: 'Skip the car', action: 'Take the metro.', why: 'Less exhaust.', impact: { estimate: 'About 2 kg CO2 less', confidence: 'medium' } }],
  indoor: [{ title: 'Close windows', action: 'Keep them shut.', why: 'Indoor air follows outdoor air.', impact: { estimate: 'Up to 30% less PM2.5', confidence: 'medium' } }],
  swaps: [{ title: 'Carpool', action: 'Share rides.', why: 'Fewer vehicles.', impact: { estimate: 'About 1 kg CO2 less', confidence: 'low' } }],
});

/** Starts the app on a random port with injected fakes. Returns the base URL and a close function. */
export async function startTestServer({ airQuality, planner, config } = {}) {
  const app = createApp({
    config: config ?? loadConfig({}),
    airQuality: airQuality ?? { getAirQuality: async () => makeAir() },
    planner: planner ?? { enabled: false, generatePlan: async () => validPlan },
    logger: silentLogger,
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

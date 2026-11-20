# Clearbreath: Urban Air Quality Assistant

A GenAI-powered assistant that helps families and communities navigate severe winter smog. Enter your city and household, and Clearbreath fetches the live air reading, then builds a plan for today with **low-emission daily routines**, **indoor air quality hacks** and **sustainable swaps**, each with a clearly labelled **estimate of its direct impact**.

Built for PromptWars Challenge 6.

## How it meets the problem statement

| Requirement | Where it lives |
| --- | --- |
| GenAI-powered | Gemini generates the plan from a guarded system prompt and a strict JSON schema (`src/services/gemini.js`, `src/schema.js`) |
| Low-emission daily routines | "Low-emission daily routine" section: commute swaps, cleaner-hours timing, mask guidance, indoor exercise on severe days |
| Indoor air quality hacks | "Indoor air quality hacks" section: ventilation timing, purifier or DIY filter, cooking and cleaning habits, a clean-air room |
| Sustainable alternatives | "Sustainable swaps" section: carpooling, short-trip alternatives, no open burning, clean cooking |
| Tailored to location | City is geocoded and the live PM2.5 and AQI for that place drive the advice |
| Tailored to lifestyle | Household (children, older adults, asthma, pregnancy), commute mode and distance, home type, purifier, cooking fuel |
| Clearly explains direct impact | Every recommendation shows **why it matters** plus an **estimated impact** with a low, medium or high confidence tag. A "no change vs with this plan" panel compares exposure and CO₂ and lists its assumptions |

## Run it

Requires Node 18 or newer.

```bash
npm install
cp .env.example .env      # optional: add GEMINI_API_KEY
npm start                  # http://localhost:3000
```

Without `GEMINI_API_KEY` the app still works in **offline guidance mode**: the same live air data, with a deterministic rule-based planner. The UI says when this happens. To load the `.env` file, run `node --env-file=.env src/server.js` or export the variables.

```bash
npm test                   # 75 tests, built-in node:test runner
npm run test:coverage      # coverage report
npm run lint
```

### Deploy

A `Dockerfile` is included (for example Google Cloud Run). Set `GEMINI_API_KEY` as a secret, and `TRUST_PROXY=1` behind a single proxy so rate limiting sees real client addresses.

## Architecture

[Architecture guide](ARCHITECTURE.md)
[Contributing guide](CONTRIBUTING.md)

```
public/            static UI (semantic HTML, CSS, vanilla ES modules, no build step)
  js/rules.js        instant client-side validation (mirrors the server)
  js/render.js       renders plans with textContent only
src/
  app.js             Express wiring: helmet CSP, rate limit, body limit, error handler
  routes/plan.js     POST /api/plan: validate, air data, Gemini or fallback, comparison
  services/
    airQuality.js    Open-Meteo geocoding and air quality, 10-minute TTL cache
    gemini.js        Gemini call, injection-safe prompt, schema-validated output
    fallbackPlanner.js  deterministic planner, same output shape
  schema.js          one schema drives the Gemini response schema AND validation
  aqi.js             pure functions: AQI categories, PM2.5, exposure and CO₂ estimates
  validation.js      allow-list request validation
test/                unit and integration tests, all network mocked
```

Design choices worth noting:

- **One schema, three uses.** `PLAN_JSON_SCHEMA` shapes the Gemini request, validates the reply (unknown keys dropped, text length-capped, enums checked) and defines what the renderer expects.
- **Graceful degradation.** Missing key, timeout, HTTP error, bad JSON or a schema mismatch all fall back to the rule-based planner. A manual AQI works even if live data is unreachable.
- **Dependency injection.** Services take `fetch` and config as arguments, so the whole API is tested with no network.
- **Transparent estimates.** The exposure and CO₂ model in `src/aqi.js` is small and documented, and its assumptions are shown to the user.

## Security

- The Gemini key lives only on the server and is sent in a header, never a URL; it is never logged or sent to the browser.
- Requests are validated against allow-lists (types, ranges, lengths, unknown fields rejected) before anything else runs.
- Prompt-injection defence: user values reach the model only as JSON data inside a `<user_data>` block, the system prompt marks it untrusted, and the reply must pass strict schema validation.
- Model output is rendered with `textContent` only, so it cannot inject markup. The CSP is `default-src 'none'` with same-origin scripts and styles and no inline code.
- `helmet` headers, rate limiting (40 requests per 15 minutes per client by default), an 8 KB body limit, no CORS, and error responses that never include stack traces or upstream details.
- CI runs lint, tests and `npm audit`.

## Accessibility (WCAG 2.1 AA aims)

Landmarks and a skip link, one `h1` with an ordered heading outline, labelled controls with `fieldset` and `legend`, inline errors linked with `aria-describedby` and `aria-invalid`, a polite live region for loading and results, a 44 px minimum touch target, visible focus rings, and colour never used alone (AQI categories carry text and a symbol). Light and dark themes, `prefers-reduced-motion` respected, and a layout that works from 320 px.

## Testing

75 tests cover AQI boundaries, PM2.5 conversion, exposure and CO₂ estimates, request validation (including hostile input), schema validation of model output, the Gemini client (headers, prompt construction, every failure path), the air-quality client (caching, upstream failures), the fallback planner across all profile combinations, and the `/api/plan` route end to end including rate limiting and security headers.

## Limitations

- Exposure and emission figures are illustrative estimates from simple assumptions, not measurements, and are labelled as such.
- AQI comes from a modelled public feed and may differ from a nearby monitor; use the manual AQI box in that case.
- General guidance only. It is not medical advice.

Air quality data by [Open-Meteo](https://open-meteo.com/) (CC BY 4.0).

## License

MIT

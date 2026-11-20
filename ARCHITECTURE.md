# Architecture

Clearbreath is a Node.js and Express application with a static browser client. The browser uses native ES modules and the server owns all external service access and secret handling.

## Request flow

1. `public/js/main.js` reads the form, applies quick client-side validation, and sends a JSON request through `public/js/api.js`.
2. Express applies security headers, compression, API rate limiting, and the JSON body limit in `src/app.js`.
3. `src/routes/plan.js` validates the request with the allow-list rules in `src/validation.js`.
4. `src/services/airQuality.js` resolves the city and returns live or manual air data. Successful live results use a bounded TTL cache.
5. `src/services/gemini.js` requests a structured plan when configured. `src/schema.js` validates and normalizes the model output. Any planner failure uses `src/services/fallbackPlanner.js`.
6. `src/aqi.js` produces illustrative exposure and commute-emissions comparisons. The route returns the plan, reading, comparison, and disclaimer together.
7. `public/js/render.js` builds DOM nodes and inserts model-facing strings through `textContent`.

## Boundaries

- `src/app.js` composes middleware and routes; middleware policies live in `src/middleware/`.
- `src/routes/` handles HTTP concerns and coordinates services.
- `src/services/` contains upstream clients and planning logic, with injected fetch implementations for deterministic tests.
- `src/types.js` contains JSDoc typedefs only and has no runtime behavior.
- `public/` is served as static content and does not receive the Gemini key.
- `test/` covers pure calculations, validation, service behavior, and HTTP integration using mocked upstream calls.

## Security and failure handling

The Gemini key stays on the server and is sent in a request header. Input values are treated as untrusted prompt data, model output must match the plan schema, and the renderer does not interpret model content as HTML. Express maps known application and request parsing errors to stable JSON responses; unexpected errors are logged by name and return a generic response. If live air data cannot be obtained, a supplied manual AQI can still be used. If Gemini is unavailable, rule-based guidance is returned.

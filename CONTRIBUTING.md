# Contributing

## Setup

Use Node.js 18 or newer, install dependencies with `npm ci`, and copy `.env.example` to `.env` only if you need local secrets. Keep `.env` and all API keys out of commits and logs.

## Checks

Run the full local quality check before submitting a change:

```bash
npm run check
```

This runs ESLint and the Node test suite. Tests mock external services and should not require API keys or live air-quality calls.

## Code changes

- Keep route handlers focused on HTTP behavior and place reusable logic in services or pure modules.
- Preserve response text, JSON shape, headers, accessibility labels, and DOM structure unless the change explicitly requires behavior changes.
- Add tests for new logic and update existing tests only when behavior is intentionally changed.
- Use the existing JSDoc typedefs in `src/types.js` to describe exported function contracts.
- Keep browser code dependency-free and render untrusted content with text nodes.
- Do not add dependencies without a clear need; update the lockfile when dependency changes are approved.

## Pull requests

Describe the user-visible effect, note relevant security or compatibility implications, and include the output of `npm run check`.

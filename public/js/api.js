const REQUEST_TIMEOUT_MS = 45_000;

/** Error carrying API field messages so the form can mark inputs. */
export class ApiError extends Error {
  /** Creates an API error with optional field-level messages.
   * @param {string} message User-facing error.
   * @param {import('../../src/types.js').FieldError[]} [fields] Field errors.
   */
  constructor(message, fields = []) {
    super(message);
    this.name = 'ApiError';
    this.fields = fields;
  }
}

/** Sends a plan request and parses its response.
 * @param {import('../../src/types.js').PlanRequest} payload Validated request payload.
 * @returns {Promise<import('../../src/types.js').PlanResponse>} Plan response.
 */
export async function requestPlan(payload) {
  let response;
  try {
    response = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError('We could not reach the server. Check your connection and try again.');
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error page; handled below.
  }

  if (!response.ok) {
    throw new ApiError(body?.error?.message ?? 'Something went wrong. Please try again.', body?.error?.fields ?? []);
  }
  return body;
}

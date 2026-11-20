/**
 * An error that is safe to describe to the client.
 * `message` and `fields` may be sent to the browser; `cause` and `meta` stay on the server.
 */
export class AppError extends Error {
  /**
   * Creates an error with a client-safe message and status.
   * @param {number} status HTTP status code
   * @param {string} code stable machine-readable code
   * @param {string} message client-safe description
   * @param {{ fields?: Array<{field: string, message: string}>, cause?: unknown, meta?: Record<string, unknown> }} [options]
   */
  constructor(status, code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fields = options.fields;
    this.meta = options.meta;
  }
}

/** Builds the standard API error response body.
 * @param {string} code Stable machine-readable code.
 * @param {string} message Client-safe message.
 * @param {import('./types.js').FieldError[]} [fields] Optional field errors.
 * @returns {{ error: { code: string, message: string, fields?: import('./types.js').FieldError[] } }} Error body.
 */
export function errorBody(code, message, fields) {
  return { error: { code, message, ...(fields ? { fields } : {}) } };
}

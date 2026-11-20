/**
 * An error that is safe to describe to the client.
 * `message` and `fields` may be sent to the browser; `cause` and `meta` stay on the server.
 */
export class AppError extends Error {
  /**
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

/** Shape of every error response body. */
export function errorBody(code, message, fields) {
  return { error: { code, message, ...(fields ? { fields } : {}) } };
}

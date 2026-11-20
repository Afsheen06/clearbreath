import { AppError, errorBody } from '../errors.js';

/** Creates the centralized Express error handler.
 * @param {Pick<Console, 'error'>} logger Error logger.
 * @returns {import('express').ErrorRequestHandler} Error middleware.
 */
export function createErrorHandler(logger) {
  return (error, _req, res, _next) => {
    if (error instanceof AppError) {
      return res.status(error.status).json(errorBody(error.code, error.message, error.fields));
    }
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json(errorBody('invalid_json', 'The request body is not valid JSON.'));
    }
    if (error?.type === 'entity.too.large') {
      return res.status(413).json(errorBody('payload_too_large', 'The request is too large.'));
    }
    logger.error(`Unhandled error: ${error?.name ?? 'Error'}`);
    return res.status(500).json(errorBody('internal_error', 'Something went wrong on our side. Please try again.'));
  };
}

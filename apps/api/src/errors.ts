/**
 * Small typed HTTP error so handlers can `throw badRequest('...')` and let a
 * single error handler translate it into a clean JSON response + the right
 * metric. Keeps the happy path readable.
 */
export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, message: string, code = 'error') {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const badRequest = (message: string, code = 'bad_request'): HttpError =>
  new HttpError(400, message, code);

export const unauthorized = (
  message = 'unauthorized',
  code = 'unauthorized',
): HttpError => new HttpError(401, message, code);

export const forbidden = (message = 'forbidden', code = 'forbidden'): HttpError =>
  new HttpError(403, message, code);

export const notFound = (message = 'not found', code = 'not_found'): HttpError =>
  new HttpError(404, message, code);

export const conflict = (message: string, code = 'conflict'): HttpError =>
  new HttpError(409, message, code);

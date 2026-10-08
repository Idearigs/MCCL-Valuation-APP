import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError, type ZodType, type z } from 'zod';
import multer from 'multer';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Not found') => new HttpError(404, what);

/** Parse a request part with a zod schema, turning failures into a 400. */
export function parse<S extends ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(400, 'Validation failed', result.error.issues.map(i => ({
      path: i.path.join('.'),
      message: i.message,
    })));
  }
  return result.data;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A route param that must be a UUID; anything else is simply "not found". */
export function uuidParam(value: unknown, what = 'Not found'): string {
  const s = String(value);
  if (!UUID_RE.test(s)) throw new HttpError(404, what);
  return s;
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', details: err.issues });
    return;
  }
  if (err instanceof multer.MulterError) {
    res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.message });
    return;
  }
  // express.json() errors (malformed body, too large) carry a status
  const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) req.log?.error({ err }, 'Unhandled error');
  res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
};

import { Request, Response, NextFunction } from 'express';

export class ValidationError extends Error {
  constructor(message: string, public details?: string[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err.name === 'ValidationError') {
    const e = err as ValidationError;
    res.status(400).json({ error: e.message, details: e.details });
    return;
  }
  if (err.name === 'AuthError') {
    res.status(403).json({ error: err.message });
    return;
  }
  if (err.name === 'NotFoundError') {
    res.status(404).json({ error: err.message });
    return;
  }
  if (err.name === 'ConflictError') {
    res.status(409).json({ error: err.message });
    return;
  }
  // express-openapi-validator errors
  if ('status' in err && typeof (err as { status: unknown }).status === 'number') {
    const httpErr = err as { status: number; message: string; errors?: unknown[] };
    res.status(httpErr.status).json({ error: httpErr.message, details: httpErr.errors });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}

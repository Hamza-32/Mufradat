import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

/**
 * One response shape for every API route. `code` is for the client to branch
 * on; `message` is for a developer reading a log, never for display — user
 * facing copy is chosen in the interface, in the interface's language.
 */
export interface ApiError {
  error: {
    code:
      | 'unauthorized'
      | 'rate_limited'
      | 'invalid_request'
      | 'not_found'
      | 'conflict'
      | 'server_error';
    message: string;
    details?: unknown;
  };
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, init);
}

export function fail(
  code: ApiError['error']['code'],
  message: string,
  status: number,
  details?: unknown,
): NextResponse<ApiError> {
  return NextResponse.json<ApiError>(
    { error: details === undefined ? { code, message } : { code, message, details } },
    { status },
  );
}

export const unauthorized = (): NextResponse<ApiError> =>
  fail('unauthorized', 'Sign in to continue', 401);

export const rateLimited = (retryAfterSeconds: number): NextResponse<ApiError> => {
  const response = fail('rate_limited', 'Too many requests', 429);
  response.headers.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterSeconds))));
  return response;
};

export const invalid = (error: ZodError): NextResponse<ApiError> =>
  fail('invalid_request', 'Request body failed validation', 422, error.flatten());

export const serverError = (): NextResponse<ApiError> =>
  fail('server_error', 'Something went wrong', 500);

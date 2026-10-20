export type ErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'secrets_unavailable'
  | 'internal'

const STATUS: Record<ErrorCode, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  secrets_unavailable: 503,
  internal: 500
}

/** Every error leaves the API as `{ error: { code, message } }`. */
export class ApiError extends Error {
  readonly status: number
  constructor(
    readonly code: ErrorCode,
    message: string
  ) {
    super(message)
    this.status = STATUS[code]
  }
}

export const notFound = (what: string): ApiError => new ApiError('not_found', `${what} not found`)
export const unauthorized = (message = 'Sign in again'): ApiError =>
  new ApiError('unauthorized', message)

export function orNotFound<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw notFound(what)
  return value
}
export const forbidden = (message = 'Only admins can do this'): ApiError =>
  new ApiError('forbidden', message)

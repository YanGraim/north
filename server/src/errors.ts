export type ErrorCode = 'validation' | 'unauthorized' | 'not_found' | 'conflict' | 'internal'

const STATUS: Record<ErrorCode, number> = {
  validation: 400,
  unauthorized: 401,
  not_found: 404,
  conflict: 409,
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

/**
 * Backward-compatible JANET error helpers.
 * The Day 2 client uses the newer lib/janet/errors module directly;
 * these exports preserve the existing frontend/test import surface.
 */

export class JanetAPIError extends Error {
  statusCode: number
  originalError?: unknown

  constructor(message: string, statusCode = 500, originalError?: unknown) {
    super(message)
    this.name = 'JanetAPIError'
    this.statusCode = statusCode
    this.originalError = originalError
    Object.setPrototypeOf(this, JanetAPIError.prototype)
  }

  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500
  }

  isServerError(): boolean {
    return this.statusCode >= 500
  }

  isNetworkError(): boolean {
    return this.statusCode === 0
  }
}

export function parseJanetError(response: Response, originalError?: unknown): JanetAPIError {
  const message =
    response.status === 404
      ? 'Memory not found'
      : response.status === 400
        ? 'Invalid request to JANET service'
        : response.status === 500
          ? 'JANET service error'
          : `JANET service returned ${response.status}`
  return new JanetAPIError(message, response.status, originalError)
}

export function parseNetworkError(error: unknown): JanetAPIError {
  if (error instanceof Error) {
    return new JanetAPIError(`Network error: ${error.message}`, 0, error)
  }
  return new JanetAPIError('Unknown network error', 0, error)
}

export function getUserErrorMessage(error: JanetAPIError): string {
  if (error.isNetworkError()) return "Cannot reach JANET service. Check if it's running on port 3001."
  if (error.statusCode === 404) return 'Memory not found. It may have been deleted.'
  if (error.statusCode === 400) return 'Invalid request. Please check your input.'
  if (error.isServerError()) return 'JANET service error. Please try again later.'
  return error.message || 'Unknown error occurred'
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, baseDelayMs = 100): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (error instanceof JanetAPIError && !error.isNetworkError()) throw error
      if (attempt === maxRetries - 1) break
      await new Promise(resolve => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt)))
    }
  }
  throw lastError
}

export async function assertResponseOk(response: Response): Promise<void> {
  if (!response.ok) throw parseJanetError(response)
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T
  } catch (error) {
    throw new JanetAPIError('Failed to parse JANET service response', response.status, error)
  }
}

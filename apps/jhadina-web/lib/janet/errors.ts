import type { JanetErrorResponse } from './types'

export class JanetApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'JanetApiError'
  }

  isNetworkError() {
    return this.statusCode === 0
  }

  isServerError() {
    return this.statusCode >= 500
  }
}

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as JanetErrorResponse
    return data.message || data.error
  } catch {
    return null
  }
}

export async function assertJanetResponse(response: Response) {
  if (response.ok) {
    return
  }

  const message =
    (await readErrorMessage(response)) ||
    (response.status === 404
      ? 'Requested JANET resource was not found.'
      : response.status === 400
        ? 'JANET rejected the request.'
        : 'JANET request failed.')

  throw new JanetApiError(message, response.status)
}

export function parseJanetNetworkError(error: unknown) {
  if (error instanceof JanetApiError) {
    return error
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return new JanetApiError('JANET request timed out.', 0, error)
  }

  if (error instanceof Error) {
    return new JanetApiError(error.message, 0, error)
  }

  return new JanetApiError('Unknown JANET network error.', 0, error)
}

export async function parseJanetJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch (error) {
    throw new JanetApiError('JANET returned invalid JSON.', response.status, error)
  }
}

export function getJanetErrorMessage(error: JanetApiError) {
  if (error.isNetworkError()) {
    return 'Cannot reach JANET service. Check that it is running on port 3001.'
  }

  if (error.isServerError()) {
    return 'JANET is currently unavailable. Please try again.'
  }

  return error.message
}

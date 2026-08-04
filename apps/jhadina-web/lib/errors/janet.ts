/**
 * JANET API Error Handling
 * 
 * Graceful error handling for all JANET service interactions.
 * Follows verified error patterns from Phase 1A contract.
 */

import type { ErrorResponse } from "./janet"

/**
 * Custom error class for JANET API failures
 */
export class JanetAPIError extends Error {
  statusCode: number
  originalError?: unknown

  constructor(
    message: string,
    statusCode: number = 500,
    originalError?: unknown
  ) {
    super(message)
    this.name = "JanetAPIError"
    this.statusCode = statusCode
    this.originalError = originalError

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, JanetAPIError.prototype)
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.statusCode >= 500
  }

  /**
   * Check if error is a network/timeout error
   */
  isNetworkError(): boolean {
    return this.statusCode === 0
  }
}

/**
 * Parse error response from JANET service
 * 
 * Handles both structured error responses and raw errors.
 */
export function parseJanetError(
  response: Response,
  originalError?: unknown
): JanetAPIError {
  // Specific error status codes
  if (response.status === 404) {
    return new JanetAPIError(
      "Memory not found",
      404,
      originalError
    )
  }

  if (response.status === 400) {
    return new JanetAPIError(
      "Invalid request to JANET service",
      400,
      originalError
    )
  }

  if (response.status === 500) {
    return new JanetAPIError(
      "JANET service error",
      500,
      originalError
    )
  }

  // Generic error for any other status
  return new JanetAPIError(
    `JANET service returned ${response.status}`,
    response.status,
    originalError
  )
}

/**
 * Handle network errors (fetch failures, timeouts, etc.)
 */
export function parseNetworkError(error: unknown): JanetAPIError {
  if (error instanceof TypeError) {
    // Network error or CORS issue
    if (error.message.includes("fetch")) {
      return new JanetAPIError(
        "Cannot connect to JANET service. Is it running?",
        0,
        error
      )
    }
  }

  if (error instanceof Error) {
    return new JanetAPIError(
      `Network error: ${error.message}`,
      0,
      error
    )
  }

  return new JanetAPIError(
    "Unknown network error",
    0,
    error
  )
}

/**
 * User-friendly error message for UI display
 */
export function getUserErrorMessage(error: JanetAPIError): string {
  if (error.isNetworkError()) {
    return "Cannot reach JANET service. Check if it's running on port 3001."
  }

  if (error.statusCode === 404) {
    return "Memory not found. It may have been deleted."
  }

  if (error.statusCode === 400) {
    return "Invalid request. Please check your input."
  }

  if (error.isServerError()) {
    return "JANET service error. Please try again later."
  }

  return error.message || "Unknown error occurred"
}

/**
 * Retry logic for transient failures
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 100
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Don't retry if not a network error
      if (error instanceof JanetAPIError && !error.isNetworkError()) {
        throw error
      }

      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        break
      }

      // Exponential backoff
      const delayMs = baseDelayMs * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}

/**
 * Assert response is OK (200-299)
 */
export async function assertResponseOk(response: Response): Promise<void> {
  if (!response.ok) {
    throw parseJanetError(response)
  }
}

/**
 * Parse JSON response with error handling
 */
export async function parseJsonResponse<T>(
  response: Response
): Promise<T> {
  try {
    return await response.json() as T
  } catch (error) {
    throw new JanetAPIError(
      "Failed to parse JANET service response",
      response.status,
      error
    )
  }
}

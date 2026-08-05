/**
 * JANET API Library Barrel Export
 * 
 * Central entry point for all JANET service interactions.
 * 
 * Usage:
 * import { janetClient, JanetAPIError } from '@/lib/janet'
 */

export { JanetClient, janetClient, createJanetClient } from './client'
export type {
  MemoryCandidate,
  MemoryCategory,
  MemoryStatus,
  CreateMemoryCandidateRequest,
  CreateMemoryCandidateResponse,
  ApproveMemoryResponse,
  UserProfile,
  HealthCheckResponse,
  JanetErrorResponse,
} from './types'
export {
  JanetApiError,
  assertJanetResponse,
  getJanetErrorMessage,
  parseJanetJson,
  parseJanetNetworkError,
} from './errors'

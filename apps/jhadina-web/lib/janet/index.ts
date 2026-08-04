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
  Memory,
  MemoryType,
  MemoryStatus,
  CreateMemoryCandidateRequest,
  CreateMemoryCandidateResponse,
  ApproveMemoryResponse,
  SearchMemoriesQuery,
  SearchMemoriesResponse,
  UserProfile,
  HealthCheckResponse,
  ErrorResponse,
  AuditEvent,
} from '../types/janet'

export { JANET_CONFIG, HTTP_STATUS } from '../types/janet'
export {
  JanetAPIError,
  parseJanetError,
  parseNetworkError,
  getUserErrorMessage,
  retryWithBackoff,
  assertResponseOk,
  parseJsonResponse,
} from '../errors/janet'

/**
 * JANET Service Type Definitions
 * 
 * Generated from verified Phase 1A contract
 * Source: VERIFICATION_REPORT.md
 * 
 * This is the single source of truth for JANET API integration.
 * Do not modify without updating contract in crispy-waddle root.
 */

/**
 * Memory type classification
 * Assigned by JANET during candidate creation
 */
export type MemoryType = 
  | "PREFERENCE"   // User preferences and tastes
  | "IDENTITY"     // Who the user is
  | "GOAL"         // What the user wants to achieve
  | "CONTEXT"      // Background information

/**
 * Memory lifecycle status
 */
export type MemoryStatus = 
  | "PENDING"      // Awaiting user approval
  | "APPROVED"     // User approved, stored
  | "REJECTED"     // User rejected
  | "ARCHIVED"     // User archived

/**
 * Complete memory object from JANET service
 * 
 * Key principle: All memories must be approved by user before storage.
 * Search only returns APPROVED memories.
 */
export interface Memory {
  id: string                    // Unique identifier: "mem_1", "mem_2", etc.
  type: MemoryType              // Classification assigned by JANET
  status: MemoryStatus          // Current lifecycle status
  content: string               // Original user input text
  confidence: number            // 0.0 - 1.0, JANET confidence score
  createdAt?: string            // ISO8601 timestamp
  approvedAt?: string           // ISO8601 timestamp (if APPROVED)
  userId?: string               // User ID (currently "user_demo")
}

/**
 * Request to create a memory candidate
 * 
 * JANET will classify this input and return a Memory with status PENDING.
 */
export interface CreateMemoryCandidateRequest {
  content: string
}

/**
 * Response when creating a memory candidate
 * Status is always PENDING initially.
 */
export interface CreateMemoryCandidateResponse extends Memory {
  status: "PENDING"
}

/**
 * Response when approving a memory
 * Status changes from PENDING to APPROVED.
 */
export interface ApproveMemoryResponse {
  id: string
  status: "APPROVED"
  approvedAt: string            // ISO8601 timestamp
}

/**
 * Query parameters for memory search
 */
export interface SearchMemoriesQuery {
  query: string                 // Search term (matches content)
}

/**
 * Search results - only returns APPROVED memories
 */
export interface SearchMemoriesResponse extends Array<Memory> {}

/**
 * User profile with aggregated statistics
 */
export interface UserProfile {
  userId: string                // Currently "user_demo" in Phase 1A
  stats: {
    totalMemories: number       // All approved memories
    pendingApprovals: number    // Waiting for user decision
    identityMemories: number    // Count of IDENTITY type memories
  }
}

/**
 * Service health check response
 */
export interface HealthCheckResponse {
  status: "ok" | "error"
  service: string               // "janet-memory"
  timestamp: string             // ISO8601 timestamp
}

/**
 * Standard error response
 * Note: Inferred from REST conventions. Actual format needs live testing.
 */
export interface ErrorResponse {
  error: string                 // Error message
  statusCode: 400 | 401 | 404 | 500
  timestamp: string             // ISO8601 timestamp
}

/**
 * Audit event structure (Phase 1C)
 * Currently not implemented but included for reference.
 * 
 * Every user action will eventually be tracked with this structure.
 */
export interface AuditEvent {
  timestamp: string             // ISO8601
  actor: string                 // User ID
  action: "CREATE" | "APPROVE" | "REJECT" | "ARCHIVE"
  resource: string              // Memory ID
  changes: Record<string, unknown>
  result: "SUCCESS" | "FAILURE"
}

/**
 * API Client Configuration
 */
export const JANET_CONFIG = {
  SERVICE_URL: process.env.NEXT_PUBLIC_JANET_URL || "http://localhost:3001",
  USER_ID: "user_demo",  // Phase 1A: hardcoded user
  TIMEOUT_MS: 5000,
} as const

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
} as const

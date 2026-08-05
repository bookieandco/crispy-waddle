export type MemoryCategory = 'PREFERENCE' | 'IDENTITY' | 'GOAL' | 'CONTEXT'

export type MemoryStatus = 'PENDING' | 'APPROVED'

export interface MemoryCandidate {
  id: string
  type: MemoryCategory
  status: MemoryStatus
  content?: string
  confidence?: number
  reasoning?: string
  createdAt?: string
}

export interface CreateMemoryCandidateRequest {
  content: string
}

export interface CreateMemoryCandidateResponse extends MemoryCandidate {
  status: 'PENDING'
}

export interface ApproveMemoryResponse {
  id: string
  status: 'APPROVED'
  approvedAt: string
}

export interface HealthCheckResponse {
  status: 'ok' | 'error'
  service: string
  timestamp: string
}

export interface UserProfile {
  userId: string
  stats: {
    totalMemories: number
    pendingApprovals: number
    identityMemories: number
  }
}

export interface JanetErrorResponse {
  error?: string
  message?: string
}

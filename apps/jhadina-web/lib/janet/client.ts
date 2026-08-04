/**
 * JANET Service API Client
 * 
 * Centralized, typed client for all JANET interactions.
 * Source of truth: verified Phase 1A contract.
 * 
 * No mocking. All responses are from the live JANET service on port 3001.
 */

import type {
  Memory,
  CreateMemoryCandidateRequest,
  CreateMemoryCandidateResponse,
  ApproveMemoryResponse,
  SearchMemoriesQuery,
  SearchMemoriesResponse,
  UserProfile,
  HealthCheckResponse,
  JANET_CONFIG,
} from "../types/janet"

import {
  JanetAPIError,
  parseJanetError,
  parseNetworkError,
  parseJsonResponse,
  assertResponseOk,
} from "../errors/janet"

/**
 * JANET Service Client
 * 
 * Provides type-safe access to all JANET endpoints.
 * Handles authentication (hardcoded to user_demo in Phase 1A).
 * Manages error recovery and timeouts.
 */
export class JanetClient {
  private baseUrl: string
  private timeoutMs: number

  constructor(baseUrl?: string, timeoutMs?: number) {
    this.baseUrl = baseUrl || "http://localhost:3001"
    this.timeoutMs = timeoutMs || 5000
  }

  /**
   * Make an HTTP request with timeout and error handling
   */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      })

      clearTimeout(timeoutId)

      await assertResponseOk(response)
      return await parseJsonResponse<T>(response)
    } catch (error) {
      if (error instanceof JanetAPIError) {
        throw error
      }
      throw parseNetworkError(error)
    }
  }

  /**
   * GET /health
   * 
   * Check if JANET service is running and healthy.
   * 
   * @returns Health status
   * @throws JanetAPIError if service is unavailable
   */
  async getHealth(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>("/health", {
      method: "GET",
    })
  }

  /**
   * POST /memory/candidate
   * 
   * Submit information to JANET for classification.
   * JANET will analyze the content and create a memory candidate.
   * 
   * The memory is created with status PENDING - awaiting user approval.
   * User must approve before the memory is stored.
   * 
   * @param content User's input text
   * @returns Created memory candidate with JANET's classification
   * @throws JanetAPIError if creation fails
   * 
   * @example
   * const candidate = await client.createMemoryCandidate(
   *   "I prefer watching cinematic movies with luxury aesthetics"
   * )
   * console.log(candidate.type) // "PREFERENCE"
   * console.log(candidate.confidence) // 0.95
   */
  async createMemoryCandidate(
    content: string
  ): Promise<CreateMemoryCandidateResponse> {
    const body: CreateMemoryCandidateRequest = { content }

    return this.request<CreateMemoryCandidateResponse>("/memory/candidate", {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  /**
   * GET /memory/pending
   * 
   * Retrieve all pending memory candidates awaiting user approval.
   * 
   * These memories have been classified by JANET but not yet approved by the user.
   * The user should review each candidate and decide whether to approve or reject it.
   * 
   * @returns Array of pending memories
   * @throws JanetAPIError if retrieval fails
   * 
   * @example
   * const pending = await client.getPendingMemories()
   * pending.forEach(memory => {
   *   console.log(memory.content)  // User's original input
   *   console.log(memory.type)     // JANET's classification
   *   console.log(memory.confidence) // JANET's confidence (0-1)
   * })
   */
  async getPendingMemories(): Promise<Memory[]> {
    return this.request<Memory[]>("/memory/pending", {
      method: "GET",
    })
  }

  /**
   * POST /memory/{id}/approve
   * 
   * User approves a pending memory candidate.
   * 
   * This transitions the memory from PENDING to APPROVED status.
   * Only approved memories are stored and searchable.
   * Approval timestamp is recorded for audit purposes.
   * 
   * @param memoryId The ID of the memory to approve (e.g., "mem_1")
   * @returns Updated memory with APPROVED status and timestamp
   * @throws JanetAPIError if approval fails
   * 
   * @example
   * const approved = await client.approveMemory("mem_1")
   * console.log(approved.status)    // "APPROVED"
   * console.log(approved.approvedAt) // "2026-08-03T22:31:00.000Z"
   */
  async approveMemory(memoryId: string): Promise<ApproveMemoryResponse> {
    return this.request<ApproveMemoryResponse>(
      `/memory/${memoryId}/approve`,
      {
        method: "POST",
      }
    )
  }

  /**
   * GET /memory/search?query={query}
   * 
   * Search through approved memories.
   * 
   * IMPORTANT: This search ONLY returns APPROVED memories.
   * Pending memories are never included in search results.
   * 
   * Search matches against the content field.
   * 
   * @param query Search term
   * @returns Array of matching approved memories
   * @throws JanetAPIError if search fails
   * 
   * @example
   * const results = await client.searchMemories("cinematic")
   * // Returns all approved memories containing "cinematic"
   */
  async searchMemories(query: string): Promise<SearchMemoriesResponse> {
    const params = new URLSearchParams({ query })
    return this.request<SearchMemoriesResponse>(
      `/memory/search?${params.toString()}`,
      {
        method: "GET",
      }
    )
  }

  /**
   * GET /profile
   * 
   * Retrieve user profile with memory statistics.
   * 
   * Currently returns data for the hardcoded user "user_demo" (Phase 1A).
   * In Phase 1B, authentication will enable per-user profiles.
   * 
   * @returns User profile with aggregated statistics
   * @throws JanetAPIError if retrieval fails
   * 
   * @example
   * const profile = await client.getProfile()
   * console.log(profile.stats.totalMemories) // 42
   * console.log(profile.stats.pendingApprovals) // 3
   */
  async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>("/profile", {
      method: "GET",
    })
  }
}

/**
 * Create default JANET client instance
 * 
 * Uses environment variable NEXT_PUBLIC_JANET_URL or defaults to localhost:3001
 */
export function createJanetClient(): JanetClient {
  const baseUrl = typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_JANET_URL || "http://localhost:3001"
    : "http://localhost:3001"

  return new JanetClient(baseUrl)
}

/**
 * Singleton instance for use throughout the application
 * 
 * Import this instead of creating new instances:
 * 
 * @example
 * import { janetClient } from "@/lib/janet/client"
 * 
 * const pending = await janetClient.getPendingMemories()
 */
export const janetClient = createJanetClient()

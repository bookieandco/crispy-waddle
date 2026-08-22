/**
 * Route Handlers: API Layer
 * 
 * Bridges HTTP requests to JanetService.
 * 
 * Routes:
 *   POST   /api/message          - Process user message
 *   POST   /api/memory/approve   - Approve a memory candidate
 *   POST   /api/memory/reject    - Reject a memory candidate
 *   GET    /api/candidates       - List pending candidates
 *   GET    /api/memories         - List approved memories
 *   GET    /api/memories/search  - Search memories
 *   GET    /api/health           - Health check
 * 
 * All routes require userId in request (from auth middleware in future).
 */

import { NextRequest, NextResponse } from "next/server"
import { JanetService } from "../services/JanetService"
import { Classifier } from "../services/Classifier"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import { SupabaseMemoryStorage } from "../storage/SupabaseMemoryStorage"
import { createServiceRoleClient } from "../supabase/service-role"
import type { MemoryStorage } from "../storage/MemoryStorage"

// Global singleton (in production, this would be dependency injection)
let storage: MemoryStorage
let janet: JanetService

/**
 * Durable by default: uses the real Supabase-backed store whenever a
 * service-role client is configured. Falls back to InMemoryStorage only
 * when it isn't (local dev without env configured, or tests) — loudly,
 * once, rather than silently pretending memory is durable when it isn't.
 */
function createStorage(): MemoryStorage {
  const client = createServiceRoleClient()
  if (client) return new SupabaseMemoryStorage(client)

  console.warn(
    "[jhadina-web] SUPABASE_SERVICE_ROLE_KEY not configured — falling back " +
    "to InMemoryStorage. Memory will NOT survive an application restart. " +
    "See supabase/migrations/20260822000000_create_jhadina_memory_core.sql."
  )
  return new InMemoryStorage()
}

/**
 * Exported so other composition roots (e.g. the Intelligence Router's
 * governed-intelligence-runtime.ts) share this same storage instance
 * rather than standing up a second one — a model-proposed candidate and
 * a Classifier-proposed candidate both need to land in the one real
 * /api/candidates list, not two disconnected stores.
 */
export function getStorage(): MemoryStorage {
  if (!storage) storage = createStorage()
  return storage
}

function getJanetService(): JanetService {
  if (!janet) {
    const memoryRepo = new MemoryRepository(getStorage())
    const reasoningRepo = new ReasoningEventRepository(getStorage())
    const timelineRepo = new TimelineRepository(getStorage())
    const classifier = new Classifier()
    janet = new JanetService(classifier, memoryRepo, reasoningRepo, timelineRepo)
  }
  return janet
}

function extractUserId(req: NextRequest): string | null {
  // In production: extract from auth context
  // For now: from header or default to demo
  const userId = req.headers.get("x-user-id") || "user_demo"
  return userId
}

// ═══════════════════════════════════════════════════════════════
// POST /api/message
// ═══════════════════════════════════════════════════════════════

export async function handleMessage(req: NextRequest) {
  try {
    const userId = extractUserId(req)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { message } = await req.json()

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      )
    }

    if (message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message cannot be empty" },
        { status: 400 }
      )
    }

    const service = getJanetService()
    const response = await service.processMessage({
      userId,
      message: message.trim(),
    })

    return NextResponse.json({
      success: true,
      data: {
        reasoningEventId: response.reasoningEventId,
        candidateId: response.memoryCandidate.id,
        classification: response.classification,
        systemResponse: response.response,
        confidence: response.confidence,
      },
    })
  } catch (error) {
    console.error("Error processing message:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/memory/approve
// ═══════════════════════════════════════════════════════════════

export async function handleApproveMemory(req: NextRequest) {
  try {
    const userId = extractUserId(req)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { candidateId } = await req.json()

    if (!candidateId || typeof candidateId !== "string") {
      return NextResponse.json(
        { error: "candidateId is required and must be a string" },
        { status: 400 }
      )
    }

    const service = getJanetService()
    const result = await service.approveMemory(userId, candidateId)

    return NextResponse.json({
      success: true,
      data: {
        status: result.status,
        memoryId: result.memoryId,
      },
    })
  } catch (error) {
    console.error("Error approving memory:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/memory/reject
// ═══════════════════════════════════════════════════════════════

export async function handleRejectMemory(req: NextRequest) {
  try {
    const userId = extractUserId(req)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { candidateId } = await req.json()

    if (!candidateId || typeof candidateId !== "string") {
      return NextResponse.json(
        { error: "candidateId is required and must be a string" },
        { status: 400 }
      )
    }

    const service = getJanetService()
    await service.rejectMemory(userId, candidateId)

    return NextResponse.json({
      success: true,
      data: {
        status: "REJECTED",
      },
    })
  } catch (error) {
    console.error("Error rejecting memory:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/candidates
// ═══════════════════════════════════════════════════════════════

export async function handleListCandidates(req: NextRequest) {
  try {
    const userId = extractUserId(req)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    getJanetService()
    const memoryRepo = new MemoryRepository(getStorage())

    const candidates = await memoryRepo.listPending(userId)

    return NextResponse.json({
      success: true,
      data: {
        candidates,
        count: candidates.length,
      },
    })
  } catch (error) {
    console.error("Error listing candidates:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/memories
// ═══════════════════════════════════════════════════════════════

export async function handleListMemories(req: NextRequest) {
  try {
    const userId = extractUserId(req)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    getJanetService()
    const memoryRepo = new MemoryRepository(getStorage())

    const memories = await memoryRepo.listApproved(userId)

    return NextResponse.json({
      success: true,
      data: {
        memories,
        count: memories.length,
      },
    })
  } catch (error) {
    console.error("Error listing memories:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/memories/search
// ═══════════════════════════════════════════════════════════════

export async function handleSearchMemories(req: NextRequest) {
  try {
    const userId = extractUserId(req)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const query = searchParams.get("q")

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      )
    }

    getJanetService()
    const memoryRepo = new MemoryRepository(getStorage())

    const results = await memoryRepo.search(userId, { query })

    return NextResponse.json({
      success: true,
      data: {
        results,
        count: results.length,
      },
    })
  } catch (error) {
    console.error("Error searching memories:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/health
// ═══════════════════════════════════════════════════════════════

export async function handleHealth(_req: NextRequest) {
  try {
    const service = getJanetService()
    const health = await service.health()

    return NextResponse.json({
      success: true,
      status: health.status,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error checking health:", error)
    return NextResponse.json(
      { error: "Health check failed" },
      { status: 500 }
    )
  }
}

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

// Global singleton (in production, this would be dependency injection)
let storage: InMemoryStorage
let janet: JanetService

function getJanetService(): JanetService {
  if (!storage) {
    storage = new InMemoryStorage()
    const memoryRepo = new MemoryRepository(storage)
    const reasoningRepo = new ReasoningEventRepository(storage)
    const timelineRepo = new TimelineRepository(storage)
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
    const memoryRepo = new MemoryRepository(
      storage || new InMemoryStorage()
    )

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
    const memoryRepo = new MemoryRepository(
      storage || new InMemoryStorage()
    )

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
    const memoryRepo = new MemoryRepository(
      storage || new InMemoryStorage()
    )

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

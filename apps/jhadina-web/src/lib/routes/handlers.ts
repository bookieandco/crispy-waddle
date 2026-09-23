/**
 * Route Handlers: API Layer
 * 
 * Bridges HTTP requests to JanetService.
 * 
 * Routes:
 *   POST   /api/message          - Process user message
 *   POST   /api/memory/approve   - Approve a memory candidate
 *   POST   /api/memory/reject    - Reject a memory candidate
 *   POST   /api/memory/correct   - Correct approved memory by revision
 *   POST   /api/memory/forget    - Retire approved memory from active recall
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
import type { MemoryStorage } from "../storage/MemoryStorage"
import { getCanonicalMemoryStorage } from "../storage/createMemoryStorage"
import { createRequestIdentityVerifier } from "../auth/request-identity"

// Janet is process-local, while Memory storage comes from the one canonical
// runtime storage graph shared by every composition root.
let janet: JanetService

export function getStorage(): MemoryStorage {
  return getCanonicalMemoryStorage()
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

async function extractUserId(req: NextRequest): Promise<string> {
  const claimedUserId = req.headers.get("x-user-id") ?? undefined
  const verifier = await createRequestIdentityVerifier()
  const identity = await verifier.verify(claimedUserId ? { userId: claimedUserId } : {})
  return identity.userId
}

// ═══════════════════════════════════════════════════════════════
// POST /api/message
// ═══════════════════════════════════════════════════════════════

export async function handleMessage(req: NextRequest) {
  try {
    const userId = await extractUserId(req)
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
    const userId = await extractUserId(req)
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
    const userId = await extractUserId(req)
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
// POST /api/memory/correct
// ═══════════════════════════════════════════════════════════════

export async function handleCorrectMemory(req: NextRequest) {
  try {
    const userId = await extractUserId(req)
    const { memoryId, content } = await req.json()
    if (typeof memoryId !== "string" || !memoryId.trim()) {
      return NextResponse.json({ error: "memoryId is required" }, { status: 400 })
    }
    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "content is required" }, { status: 400 })
    }

    const memoryRepo = new MemoryRepository(getStorage())
    const reasoningRepo = new ReasoningEventRepository(getStorage())
    const timelineRepo = new TimelineRepository(getStorage())
    const current = await memoryRepo.getById(userId, memoryId)
    if (!current || current.status !== "APPROVED") {
      return NextResponse.json({ error: "Approved memory not found" }, { status: 404 })
    }

    const now = new Date().toISOString()
    const reasoning = await reasoningRepo.create({
      userId,
      userMessage: content.trim(),
      observation: { raw: content.trim(), extracted: content.trim(), timestamp: now },
      classification: { type: current.type, confidence: 1, reasoning: "explicit user memory correction" },
      systemResponse: "Memory correction recorded.",
      confidence: 1,
      actor: "user",
      outcome: "memory:corrected",
      causationId: current.reasoningEventId,
      metadata: { kind: "memory-correction", targetMemoryId: current.id, authority: "explicit-user" },
    })
    const corrected = await memoryRepo.correct({
      memoryId: current.id,
      userId,
      content,
      reasoningEventId: reasoning.id,
      confidence: 1,
    })
    await timelineRepo.recordCorrection({
      userId,
      memoryId: corrected.replacement.id,
      memoryType: corrected.replacement.type,
      memoryContent: corrected.replacement.content,
      reasoningEventId: reasoning.id,
    })

    return NextResponse.json({
      success: true,
      data: {
        retiredMemoryId: corrected.retired.id,
        memory: corrected.replacement,
        reasoningEventId: reasoning.id,
      },
    })
  } catch (error) {
    console.error("Error correcting memory:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/memory/forget
// ═══════════════════════════════════════════════════════════════

export async function handleForgetMemory(req: NextRequest) {
  try {
    const userId = await extractUserId(req)
    const { memoryId } = await req.json()
    if (typeof memoryId !== "string" || !memoryId.trim()) {
      return NextResponse.json({ error: "memoryId is required" }, { status: 400 })
    }

    const memoryRepo = new MemoryRepository(getStorage())
    const reasoningRepo = new ReasoningEventRepository(getStorage())
    const timelineRepo = new TimelineRepository(getStorage())
    const current = await memoryRepo.getById(userId, memoryId)
    if (!current || current.status !== "APPROVED") {
      return NextResponse.json({ error: "Approved memory not found" }, { status: 404 })
    }

    const now = new Date().toISOString()
    const reasoning = await reasoningRepo.create({
      userId,
      userMessage: `Forget memory ${current.id}`,
      observation: { raw: `Forget memory ${current.id}`, extracted: current.id, timestamp: now },
      classification: { type: current.type, confidence: 1, reasoning: "explicit user memory forget request" },
      systemResponse: "Memory retired from active recall.",
      confidence: 1,
      actor: "user",
      outcome: "memory:forgotten",
      causationId: current.reasoningEventId,
      metadata: { kind: "memory-forget", targetMemoryId: current.id, authority: "explicit-user" },
    })
    const retired = await memoryRepo.forget(current.id, userId)
    await timelineRepo.recordForget({
      userId,
      memoryId: retired.id,
      memoryType: retired.type,
    })

    return NextResponse.json({
      success: true,
      data: { memoryId: retired.id, status: retired.status, reasoningEventId: reasoning.id },
    })
  } catch (error) {
    console.error("Error forgetting memory:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/candidates
// ═══════════════════════════════════════════════════════════════

export async function handleListCandidates(req: NextRequest) {
  try {
    const userId = await extractUserId(req)
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
    const userId = await extractUserId(req)
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
    const userId = await extractUserId(req)
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
    const storage = getStorage()
    if (storage.probe) {
      await storage.probe()
    } else if (process.env.NODE_ENV === "production") {
      throw new Error("JHADINA_MEMORY_DURABLE_PROBE_REQUIRED")
    }
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

/**
 * Route Handlers: API Layer
 *
 * Bridges HTTP requests to the governed Jhadina application graph.
 *
 * Memory writes and reads are allowed only after server-side Supabase
 * identity verification. The x-user-id header is treated as an untrusted
 * claim and is never accepted as authentication by itself.
 */

import { NextRequest, NextResponse } from "next/server"
import { getJhadinaApplication } from "../application/createJhadinaApplication"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { MemoryStorage } from "../storage/MemoryStorage"

/**
 * Returns the one canonical application storage instance. Keeping route
 * handlers on the composition root prevents a second in-memory universe in
 * tests/local development and keeps production on the same durable backend.
 */
export function getStorage(): MemoryStorage {
  return getJhadinaApplication().storage
}

function getJanetService() {
  return getJhadinaApplication().janet
}

async function verifyUserId(req: NextRequest): Promise<string> {
  const claimedUserId = req.headers.get("x-user-id")
  if (!claimedUserId) throw new Error("Unauthorized")

  const verifier = await createRequestIdentityVerifier()
  const identity = await verifier.verify({ userId: claimedUserId })
  return identity.userId
}

export async function handleMessage(req: NextRequest) {
  try {
    const userId = await verifyUserId(req)
    const { message } = await req.json()

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 },
      )
    }

    if (message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message cannot be empty" },
        { status: 400 },
      )
    }

    const response = await getJanetService().processMessage({
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
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Error processing message:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function handleApproveMemory(req: NextRequest) {
  try {
    const userId = await verifyUserId(req)
    const { candidateId } = await req.json()

    if (!candidateId || typeof candidateId !== "string") {
      return NextResponse.json(
        { error: "candidateId is required and must be a string" },
        { status: 400 },
      )
    }

    const result = await getJanetService().approveMemory(userId, candidateId)
    return NextResponse.json({
      success: true,
      data: { status: result.status, memoryId: result.memoryId },
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Error approving memory:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function handleRejectMemory(req: NextRequest) {
  try {
    const userId = await verifyUserId(req)
    const { candidateId } = await req.json()

    if (!candidateId || typeof candidateId !== "string") {
      return NextResponse.json(
        { error: "candidateId is required and must be a string" },
        { status: 400 },
      )
    }

    await getJanetService().rejectMemory(userId, candidateId)
    return NextResponse.json({ success: true, data: { status: "REJECTED" } })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Error rejecting memory:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function handleListCandidates(req: NextRequest) {
  try {
    const userId = await verifyUserId(req)
    const candidates = await getJhadinaApplication().memoryRepo.listPending(userId)
    return NextResponse.json({
      success: true,
      data: { candidates, count: candidates.length },
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Error listing candidates:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function handleListMemories(req: NextRequest) {
  try {
    const userId = await verifyUserId(req)
    const memories = await getJhadinaApplication().memoryRepo.listApproved(userId)
    return NextResponse.json({
      success: true,
      data: { memories, count: memories.length },
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Error listing memories:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function handleSearchMemories(req: NextRequest) {
  try {
    const userId = await verifyUserId(req)
    const query = new URL(req.url).searchParams.get("q")

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 },
      )
    }

    const results = await getJhadinaApplication().memoryRepo.search(userId, { query })
    return NextResponse.json({
      success: true,
      data: { results, count: results.length },
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Error searching memories:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function handleHealth(_req: NextRequest) {
  try {
    const health = await getJanetService().health()
    return NextResponse.json({
      success: true,
      status: health.status,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error checking health:", error)
    return NextResponse.json({ error: "Health check failed" }, { status: 500 })
  }
}

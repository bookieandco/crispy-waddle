/**
 * Route Handlers: API Layer
 * Bridges HTTP requests to JanetService.
 */

import { NextRequest, NextResponse } from "next/server"
import { JanetService } from "../services/JanetService"
import { Classifier } from "../services/Classifier"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { InMemoryStorage } from "../storage/InMemoryStorage"

let storage: InMemoryStorage
let janet: JanetService

function getJanetService(): JanetService {
  if (!storage) {
    storage = new InMemoryStorage()
    const memoryRepo = new MemoryRepository(storage)
    const reasoningRepo = new ReasoningEventRepository(storage)
    const timelineRepo = new TimelineRepository(storage)
    janet = new JanetService(new Classifier(), memoryRepo, reasoningRepo, timelineRepo)
  }
  return janet
}

function extractUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id") || "user_demo"
}

export async function handleMessage(req: NextRequest) {
  try {
    const userId = extractUserId(req)
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { message } = await req.json()
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required and cannot be empty" }, { status: 400 })
    }
    const response = await getJanetService().processMessage({ userId, message: message.trim() })
    return NextResponse.json({ success: true, data: { reasoningEventId: response.reasoningEventId, candidateId: response.memoryCandidate.id, classification: response.classification, systemResponse: response.response, confidence: response.confidence } })
  } catch (error) {
    console.error("Error processing message:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function handleApproveMemory(req: NextRequest) {
  try {
    const userId = extractUserId(req)
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { candidateId } = await req.json()
    if (!candidateId || typeof candidateId !== "string") return NextResponse.json({ error: "candidateId is required and must be a string" }, { status: 400 })
    const result = await getJanetService().approveMemory(userId, candidateId)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("Error approving memory:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function handleRejectMemory(req: NextRequest) {
  try {
    const userId = extractUserId(req)
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { candidateId } = await req.json()
    if (!candidateId || typeof candidateId !== "string") return NextResponse.json({ error: "candidateId is required and must be a string" }, { status: 400 })
    await getJanetService().rejectMemory(userId, candidateId)
    return NextResponse.json({ success: true, data: { status: "REJECTED" } })
  } catch (error) {
    console.error("Error rejecting memory:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function handleListCandidates(req: NextRequest) {
  try {
    const userId = extractUserId(req)
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const candidates = await new MemoryRepository(storage || new InMemoryStorage()).listPending(userId)
    return NextResponse.json({ success: true, data: { candidates, count: candidates.length } })
  } catch (error) {
    console.error("Error listing candidates:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function handleListMemories(req: NextRequest) {
  try {
    const userId = extractUserId(req)
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const memories = await new MemoryRepository(storage || new InMemoryStorage()).listApproved(userId)
    return NextResponse.json({ success: true, data: { memories, count: memories.length } })
  } catch (error) {
    console.error("Error listing memories:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function handleSearchMemories(req: NextRequest) {
  try {
    const userId = extractUserId(req)
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const query = new URL(req.url).searchParams.get("q")
    if (!query) return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 })
    const results = await new MemoryRepository(storage || new InMemoryStorage()).search(userId, { query })
    return NextResponse.json({ success: true, data: { results, count: results.length } })
  } catch (error) {
    console.error("Error searching memories:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function handleHealth(req: NextRequest) {
  try {
    const health = await getJanetService().health()
    const status = health.readiness === "READY" ? 200 : health.readiness === "DEGRADED" ? 200 : 503
    return NextResponse.json({ success: true, ...health, timestamp: new Date().toISOString() }, { status })
  } catch (error) {
    console.error("Error checking health:", error)
    return NextResponse.json({ success: false, status: "error", readiness: "NOT_READY", error: "Health check failed", timestamp: new Date().toISOString() }, { status: 503 })
  }
}

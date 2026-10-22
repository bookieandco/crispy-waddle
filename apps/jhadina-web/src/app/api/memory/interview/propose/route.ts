import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { getCanonicalMemoryStorage } from "@/lib/storage/createMemoryStorage"
import { MemoryRepository } from "@/lib/repositories/MemoryRepository"
import { ReasoningEventRepository } from "@/lib/repositories/ReasoningEventRepository"
import { parseRoundOneEntry, roundOneMemoryContent } from "@/lib/memory/round-one-interview"

export const dynamic = "force-dynamic"

/**
 * Explicit owner-initiated, pending-only private interview proposal.
 * No Facebook archive ingestion, auto-approval, or PersonalityState writes.
 * Source is held locally until this individual item is submitted.
 */
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin) {
    return NextResponse.json({ error: "Same-origin request required" }, { status: 403 })
  }
  if (!(req.headers.get("content-type") ?? "").startsWith("application/json")) {
    return NextResponse.json({ error: "JSON request required" }, { status: 415 })
  }
  try {
    const verifier = await createRequestIdentityVerifier()
    const claimed = req.headers.get("x-user-id") ?? undefined
    const identity = await verifier.verify(claimed ? { userId: claimed } : {})
    if (!identity.userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 })
    const raw = await req.text()
    if (raw.length > 1900) return NextResponse.json({ error: "Review payload too large" }, { status: 413 })
    const payload: unknown = JSON.parse(raw)
    if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
        (payload as { reviewed?: unknown }).reviewed !== true) {
      return NextResponse.json({ error: "Explicit owner review required" }, { status: 400 })
    }
    const entry = parseRoundOneEntry((payload as { entry?: unknown }).entry)
    const content = roundOneMemoryContent(entry)
    const storage = getCanonicalMemoryStorage()
    if (storage.probe) await storage.probe()
    else if (process.env.NODE_ENV === "production") throw new Error("DURABLE_MEMORY_REQUIRED")
    const memoryRepo = new MemoryRepository(storage)
    const prefix = "Owner interview Round 1 " + entry.questionId + " ("
    // Same-owner retries reuse identical pending work; changes require review.
    const pending = await memoryRepo.listPending(identity.userId, 1500)
    const existing = pending.find(item => item.content.startsWith(prefix))
    if (existing) {
      if (existing.content !== content) {
        return NextResponse.json({ error: "Different answer already pending. Review or reject it first." }, { status: 409 })
      }
      return NextResponse.json({ success: true, data: { status: "PENDING", candidateId: existing.id, reused: true } },
        { headers: { "cache-control": "no-store" } })
    }
    const approved = await memoryRepo.listApproved(identity.userId)
    if (approved.some(item => item.content.startsWith(prefix))) {
      return NextResponse.json({ error: "Already approved; use the canonical correction flow." }, { status: 409 })
    }
    const timestamp = new Date().toISOString()
    const reasoning = await new ReasoningEventRepository(storage).create({
      userId: identity.userId, userMessage: content,
      observation: { raw: content, extracted: content, timestamp },
      classification: { type: "CONTEXT", confidence: 1, reasoning: "Direct owner interview answer; approval pending" },
      systemResponse: "Personal interview answer proposed for approval.", confidence: 1,
      actor: "user", outcome: "memory:proposed",
      metadata: { kind: "owner-interview-round-1", questionId: entry.questionId,
        source: "owner-chat-answers", status: "pending-approval", rawFacebookReceived: false },
    })
    const candidate = await memoryRepo.createCandidate({
      userId: identity.userId, content, type: "CONTEXT", confidence: 1,
      reasoningEventId: reasoning.id,
    })
    return NextResponse.json({ success: true, data: { status: "PENDING", candidateId: candidate.id } },
      { headers: { "cache-control": "no-store" } })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    if (error instanceof Error && /interview|question|Duplicate|provenance|oversized/i.test(error.message)) {
      return NextResponse.json({ error: "Invalid reviewed interview answer" }, { status: 400 })
    }
    // Never log personal content, even on storage failures.
    return NextResponse.json({ error: "Could not save pending memory. Check login and canonical storage." }, { status: 503 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { getCanonicalMemoryStorage } from "@/lib/storage/createMemoryStorage"
import { MemoryRepository } from "@/lib/repositories/MemoryRepository"
import { ReasoningEventRepository } from "@/lib/repositories/ReasoningEventRepository"

export const dynamic = "force-dynamic"

/**
 * Only a reviewed, short OWNER-WRITTEN SUMMARY crosses this boundary.
 * Raw Facebook files, samples, friend names, messages and ZIP bytes do not.
 * This reuses the canonical pending Memory approval path; it does not write
 * PersonalityState or grant any authority to imported content.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (origin !== req.nextUrl.origin) {
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

    const text = await req.text()
    if (text.length > 3000) return NextResponse.json({ error: "Review note too large" }, { status: 413 })
    const body = JSON.parse(text) as Record<string, unknown>
    const content = typeof body.content === "string" ? body.content.trim() : ""
    const sourceCount = body.sourceCount
    if (body.reviewed !== true || content.length < 30 || content.length > 900 ||
        typeof sourceCount !== "number" || !Number.isSafeInteger(sourceCount) ||
        sourceCount < 1 || sourceCount > 2500) {
      return NextResponse.json({ error: "Reviewed writing note and valid source count required" }, { status: 400 })
    }

    const storage = getCanonicalMemoryStorage()
    if (storage.probe) await storage.probe()
    else if (process.env.NODE_ENV === "production") throw new Error("DURABLE_MEMORY_REQUIRED")

    const reasoningRepo = new ReasoningEventRepository(storage)
    const memoryRepo = new MemoryRepository(storage)
    // Best-effort same-owner retry deduplication; not an atomic concurrency guarantee.
    // Do not duplicate an already-approved summary or create new reasoning records
    // for an identical pending proposal.
    const pending = await memoryRepo.listPending(identity.userId, 2500)
    const existingPending = pending.find((candidate) => candidate.content === content)
    if (existingPending) return NextResponse.json({
      success: true, data: { candidateId: existingPending.id, status: "PENDING", reused: true },
    }, { headers: { "cache-control": "no-store" } })
    const approved = await memoryRepo.listApproved(identity.userId)
    if (approved.some((memory) => memory.content === content)) {
      return NextResponse.json({ error: "This owner writing note is already approved" }, { status: 409 })
    }
    const now = new Date().toISOString()
    const reasoning = await reasoningRepo.create({
      userId: identity.userId,
      userMessage: content,
      observation: { raw: content, extracted: content, timestamp: now },
      classification: { type: "CONTEXT", confidence: 0.5, reasoning: "Owner-reviewed Facebook writing summary, not verified personality" },
      systemResponse: "Owner writing summary submitted for approval.",
      confidence: 0.5,
      actor: "user",
      outcome: "memory:proposed",
      metadata: {
        kind: "owner-facebook-writing-review",
        source: "facebook-owner-export",
        ownerReportedSourceCount: sourceCount,
        status: "pending-approval",
        rawArchiveReceived: false,
      },
    })
    const candidate = await memoryRepo.createCandidate({
      userId: identity.userId,
      content,
      type: "CONTEXT",
      confidence: 0.5,
      reasoningEventId: reasoning.id,
    })
    return NextResponse.json(
      { success: true, data: { candidateId: candidate.id, status: "PENDING" } },
      { headers: { "cache-control": "no-store" } },
    )
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    // Never log the content of a personal import.
    return NextResponse.json({ error: "Unable to save pending memory. Confirm your signed-in session and durable storage." }, { status: 503 })
  }
}

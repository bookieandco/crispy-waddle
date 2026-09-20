import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { getStorage } from "@/lib/routes/handlers"
import { createIntelligenceAuditLedger } from "@/lib/intelligence/durable-audit-ledger"
import {
  recordPersonalityOutcomeFeedback,
  type PersonalityOutcomeFeedbackKind,
} from "@/lib/personality/personality-outcome-feedback"

export const dynamic = "force-dynamic"

const KINDS = new Set<PersonalityOutcomeFeedbackKind>([
  "reinforced",
  "corrected",
  "rejected",
  "abandoned",
])

/**
 * PERSONALITY-V2.PROD.2 — authenticated, append-only outcome feedback.
 * This route records learning evidence only. It owns no Personality mutation,
 * Memory approval, policy, or execution authority.
 */
export async function POST(req: NextRequest) {
  const claimedUserId = req.headers.get("x-jhadina-user-id") || ""
  if (!claimedUserId) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 })
  }

  const body = await req.json()
  const targetReasoningEventId =
    typeof body?.targetReasoningEventId === "string" ? body.targetReasoningEventId.trim() : ""
  const feedbackId = typeof body?.feedbackId === "string" ? body.feedbackId.trim() : ""
  const kind = typeof body?.kind === "string" ? body.kind as PersonalityOutcomeFeedbackKind : undefined
  const note = typeof body?.note === "string" ? body.note : undefined

  if (!targetReasoningEventId || !feedbackId || !kind || !KINDS.has(kind)) {
    return NextResponse.json(
      { success: false, error: "targetReasoningEventId, feedbackId, and a valid kind are required" },
      { status: 400 },
    )
  }

  try {
    const verifier = await createRequestIdentityVerifier()
    const identity = await verifier.verify({ userId: claimedUserId })
    const result = await recordPersonalityOutcomeFeedback(getStorage(), {
      userId: identity.userId,
      targetReasoningEventId,
      feedbackId,
      kind,
      note,
    })
    const ledger = await createIntelligenceAuditLedger()
    await ledger.append({
      id: `personality-feedback:${result.event.id}:${crypto.randomUUID()}`,
      actionId: result.event.id,
      userId: identity.userId,
      type: "personality.feedback.record",
      status: "completed",
      timestamp: new Date().toISOString(),
      metadata: {
        stage: "outcome-feedback",
        targetReasoningEventId,
        feedbackKind: kind,
        replayed: result.replayed,
        authority: "learning-only",
      },
    })
    return NextResponse.json({
      success: true,
      data: {
        feedbackReasoningEventId: result.event.id,
        targetReasoningEventId,
        outcome: result.event.outcome,
        replayed: result.replayed,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record feedback"
    const status =
      message.includes("identity") || message.includes("session") || message.includes("USER_MISMATCH")
        ? 401
        : message.includes("NOT_FOUND")
          ? 404
          : message.includes("REQUIRED") || message.includes("INVALID")
            ? 400
            : message.includes("IDEMPOTENCY_CONFLICT")
              ? 409
              : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

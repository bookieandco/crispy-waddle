import { NextRequest, NextResponse } from "next/server"
import type { DecisionProposal } from "@jhadina/core-spine"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { realizeAskJhadinaExpression } from "@/lib/intelligence/ask-expression"

const DISPOSITIONS = new Set<DecisionProposal["disposition"]>(["PROCEED", "ASK", "DECLINE", "DEFER"])

function boundedText(value: unknown, name: string, max: number): string {
  if (typeof value !== "string") throw new Error(`${name} is required`)
  const text = value.trim()
  if (!text || text.length > max) throw new Error(`${name} is invalid`)
  return text
}

/**
 * Presentation-only Ask Jhadina boundary for UI-local verified receipts.
 *
 * The client may supply deterministic semantic text from an already-completed
 * governed operation (for example a Director reference-video receipt). This
 * route does not execute, approve, mutate memory/personality, or accept
 * evidence claims. It only applies the authenticated user's governed
 * Personality -> Real Nigga Core -> Behavioral -> Expression presentation.
 */
export async function POST(req: NextRequest) {
  const claimedUserId = req.headers.get("x-jhadina-user-id") || ""
  if (!claimedUserId) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const activeTask = boundedText(body?.activeTask, "activeTask", 8000)
    const raw = body?.proposal
    if (!raw || typeof raw !== "object") throw new Error("proposal is required")

    const disposition = (raw as { disposition?: unknown }).disposition
    if (typeof disposition !== "string" || !DISPOSITIONS.has(disposition as DecisionProposal["disposition"])) {
      throw new Error("proposal disposition is invalid")
    }

    const verifier = await createRequestIdentityVerifier()
    const identity = await verifier.verify({ userId: claimedUserId })

    const proposal: DecisionProposal = {
      id: boundedText((raw as { id?: unknown }).id, "proposal id", 240),
      contextId: `ask-ui-expression:${crypto.randomUUID()}`,
      disposition: disposition as DecisionProposal["disposition"],
      recommendation: boundedText((raw as { recommendation?: unknown }).recommendation, "proposal recommendation", 12000),
      rationale: boundedText((raw as { rationale?: unknown }).rationale, "proposal rationale", 12000),
      evidence: [],
      uncertainty: [],
      alternatives: [],
    }

    const expression = await realizeAskJhadinaExpression({
      userId: identity.userId,
      activeTask,
      proposal,
    })

    return NextResponse.json({
      success: true,
      data: {
        presentation: expression.presentation,
        segments: expression.segments,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not realize Ask Jhadina expression"
    const status = /identity|session|signed/i.test(message) ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

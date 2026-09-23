import { NextRequest, NextResponse } from "next/server"
import { InvalidModelProposalError, parseDecisionProposal } from "@jhadina/intelligence-core"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { realizeAskJhadinaExpression } from "@/lib/intelligence/ask-expression"

export const dynamic = "force-dynamic"

/**
 * Read-only presentation boundary for deterministic Ask Jhadina results that are
 * assembled in the browser after a governed subsystem operation (currently
 * Director reference-character/product production).
 *
 * The request body is treated as untrusted input and rebuilt field-by-field
 * through parseDecisionProposal(). This route grants no action, approval,
 * memory, policy, or subsystem execution authority; it only applies the
 * governed Personality -> RNC -> Behavioral -> Expression presentation path.
 */
export async function POST(req: NextRequest) {
  const claimedUserId = req.headers.get("x-jhadina-user-id") || ""
  if (!claimedUserId) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 })
  }

  const body = await req.json()
  const activeTask = typeof body?.activeTask === "string" ? body.activeTask.trim() : ""
  if (!activeTask) {
    return NextResponse.json({ success: false, error: "activeTask is required" }, { status: 400 })
  }
  if (!body?.proposal || typeof body.proposal !== "object") {
    return NextResponse.json({ success: false, error: "proposal is required" }, { status: 400 })
  }

  try {
    const verifier = await createRequestIdentityVerifier()
    const verified = await verifier.verify({ userId: claimedUserId })
    const proposal = parseDecisionProposal(
      JSON.stringify(body.proposal),
      `ask-expression:${crypto.randomUUID()}`,
    )
    const expression = await realizeAskJhadinaExpression({
      userId: verified.userId,
      activeTask,
      proposal,
    })

    return NextResponse.json({
      success: true,
      data: {
        proposal,
        expression,
        verified: true,
        verificationReason: "Identity verified; presentation realized through the governed Personality/RNC expression path.",
      },
    })
  } catch (cause) {
    if (cause instanceof InvalidModelProposalError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: 400 })
    }
    const message = cause instanceof Error ? cause.message : "Unable to realize governed expression"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

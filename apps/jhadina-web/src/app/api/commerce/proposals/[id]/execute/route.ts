import { NextRequest, NextResponse } from "next/server"
import { runExecuteCommerceProposal } from "@/lib/commerce/commerce-proposal-runtime"

export const dynamic = "force-dynamic"

/**
 * Phase 4.6, Stage 3: POST /api/commerce/proposals/:id/execute.
 *
 * Validates identity, re-loads the durable proposal, recomputes its
 * fingerprint from the stored payload, and consumes the single-use
 * approval receipt — only then does the real (Stripe sandbox/test-mode
 * only) governed PaymentProvider call happen. See
 * commerce-proposal-lifecycle.ts's executeCommerceProposal.
 *
 * With no JHADINA_SECRET_STRIPE_SANDBOX configured in this
 * environment, this route fails closed with
 * CREDENTIAL_NOT_CONFIGURED:commerce/stripe/sandbox (mapped to 503
 * below) rather than silently succeeding or fabricating a result — that
 * is the intended human gate for this milestone, not a bug.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const claimedUserId = req.headers.get("x-jhadina-user-id") || "default-user"

  if (!params.id) {
    return NextResponse.json({ success: false, error: "proposal id is required" }, { status: 400 })
  }

  try {
    const result = await runExecuteCommerceProposal(claimedUserId, params.id)
    return NextResponse.json({
      success: true,
      data: {
        proposal: result.proposal,
        verifiedUserId: result.verifiedUserId,
        paymentId: result.paymentId,
        providerReference: result.providerReference,
        status: result.status,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to execute commerce proposal"
    const status = message.includes("identity") || message.includes("session") || message.includes("Authenticated")
      ? 401
      : message.includes("not found")
        ? 404
        : message.includes("CREDENTIAL_NOT_CONFIGURED")
          ? 503
          : message.includes("not approved") || message.includes("Invalid, expired, or already-consumed")
            ? 409
            : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

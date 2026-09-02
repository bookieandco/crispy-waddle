import { NextRequest, NextResponse } from "next/server"
import { runExecuteCommerceProposal } from "@/lib/commerce/commerce-proposal-runtime"
import { requireAuthenticatedUserId } from "@/lib/auth/require-authenticated-user"

export const dynamic = "force-dynamic"

/**
 * Phase 4.6, Stage 3: POST /api/commerce/proposals/:id/execute.
 * Identity is derived only from the server-verified session; client
 * identity headers are not trusted.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  void req
  if (!params.id) return NextResponse.json({ success: false, error: "proposal id is required" }, { status: 400 })

  try {
    const userId = await requireAuthenticatedUserId()
    const result = await runExecuteCommerceProposal(userId, params.id)
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
      : message.includes("not found") ? 404
      : message.includes("CREDENTIAL_NOT_CONFIGURED") ? 503
      : message.includes("not approved") || message.includes("Invalid, expired, or already-consumed") ? 409
      : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { runApproveCommerceProposal } from "@/lib/commerce/commerce-proposal-runtime"
import { requireAuthenticatedUserId } from "@/lib/auth/require-authenticated-user"

export const dynamic = "force-dynamic"

/**
 * Phase 4.6, Stage 2: POST /api/commerce/proposals/:id/approve.
 * The human approval act requires a server-verified authenticated session;
 * client-controlled identity headers are not trusted.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  void req
  if (!params.id) return NextResponse.json({ success: false, error: "proposal id is required" }, { status: 400 })

  try {
    const userId = await requireAuthenticatedUserId()
    const result = await runApproveCommerceProposal(userId, params.id)
    return NextResponse.json({
      success: true,
      data: { proposal: result.proposal, verifiedUserId: result.verifiedUserId, approvalReceiptId: result.approvalReceiptId },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to approve commerce proposal"
    const status = message.includes("identity") || message.includes("session") || message.includes("Authenticated") ? 401 : message.includes("not found") ? 404 : message.includes("not pending") ? 409 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

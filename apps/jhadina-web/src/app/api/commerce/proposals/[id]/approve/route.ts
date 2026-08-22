import { NextRequest, NextResponse } from "next/server"
import { runApproveCommerceProposal } from "@/lib/commerce/commerce-proposal-runtime"

export const dynamic = "force-dynamic"

/**
 * Phase 4.6, Stage 2: POST /api/commerce/proposals/:id/approve.
 *
 * The human's explicit approval act. Requires a distinct, authenticated
 * call to this route — nothing in Stage 1 (propose) or this app can
 * transition a proposal to APPROVED any other way. Issues a bound,
 * single-use approval receipt and does not execute anything; see
 * commerce-proposal-lifecycle.ts's approveCommerceProposal.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const claimedUserId = req.headers.get("x-jhadina-user-id") || "default-user"

  if (!params.id) {
    return NextResponse.json({ success: false, error: "proposal id is required" }, { status: 400 })
  }

  try {
    const result = await runApproveCommerceProposal(claimedUserId, params.id)
    return NextResponse.json({
      success: true,
      data: {
        proposal: result.proposal,
        verifiedUserId: result.verifiedUserId,
        approvalReceiptId: result.approvalReceiptId,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to approve commerce proposal"
    const status = message.includes("identity") || message.includes("session") || message.includes("Authenticated")
      ? 401
      : message.includes("not found")
        ? 404
        : message.includes("not pending")
          ? 409
          : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

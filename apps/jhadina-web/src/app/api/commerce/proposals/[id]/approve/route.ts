import { NextRequest, NextResponse } from "next/server"
import { runApproveCommerceProposal } from "@/lib/commerce/commerce-proposal-runtime"

export const dynamic = "force-dynamic"

/** Stage 2: explicit approval, bound to the server-verified Supabase identity. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!params.id) return NextResponse.json({ success: false, error: "proposal id is required" }, { status: 400 })

  try {
    const result = await runApproveCommerceProposal(undefined, params.id)
    return NextResponse.json({ success: true, data: { proposal: result.proposal, verifiedUserId: result.verifiedUserId, approvalReceiptId: result.approvalReceiptId } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to approve commerce proposal"
    const status = message.includes("identity") || message.includes("session") || message.includes("Authenticated") ? 401 : message.includes("not found") ? 404 : message.includes("not pending") ? 409 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

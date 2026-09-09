import { NextRequest, NextResponse } from "next/server"
import { runExecuteCommerceProposal } from "@/lib/commerce/commerce-proposal-runtime"

export const dynamic = "force-dynamic"

/** Stage 3: execution requires server-verified identity and a single-use approval receipt. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!params.id) return NextResponse.json({ success: false, error: "proposal id is required" }, { status: 400 })

  try {
    const result = await runExecuteCommerceProposal(undefined, params.id)
    return NextResponse.json({ success: true, data: { proposal: result.proposal, verifiedUserId: result.verifiedUserId, paymentId: result.paymentId, providerReference: result.providerReference, status: result.status } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to execute commerce proposal"
    const status = message.includes("identity") || message.includes("session") || message.includes("Authenticated") ? 401 : message.includes("not found") ? 404 : message.includes("CREDENTIAL_NOT_CONFIGURED") ? 503 : message.includes("not approved") || message.includes("Invalid, expired, or already-consumed") ? 409 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

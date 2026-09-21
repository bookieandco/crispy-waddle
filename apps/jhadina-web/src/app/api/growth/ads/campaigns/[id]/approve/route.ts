import { NextRequest, NextResponse } from "next/server"
import { approvePaidCampaign } from "@/lib/growth/governed-paid-campaign"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  try {
    const body = await req.json() as { approvalReceiptId?: string }
    if (!body.approvalReceiptId) return NextResponse.json({ success: false, error: "approvalReceiptId is required" }, { status: 400 })
    const result = await approvePaidCampaign(context.params.id, body.approvalReceiptId)
    return NextResponse.json({
      success: true,
      data: {
        campaign: result.campaign,
        outbox: result.outbox,
        providerState: result.providerState,
        governance: { capability: "paid-ad.publish", verifiedUserId: result.verifiedUserId, approvalReceiptId: body.approvalReceiptId },
      },
    }, { status: result.providerState === "pending_configuration" ? 202 : 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Paid campaign approval failed"
    const status = message.includes("Authenticated") || message.includes("session") ? 401 : message.includes("NOT_FOUND") ? 404 : 409
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

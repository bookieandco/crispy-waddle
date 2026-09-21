import { NextRequest, NextResponse } from "next/server"
import { approveAndSendSocialMessage } from "@/lib/social/governed-messaging"

export const dynamic = "force-dynamic"

export async function POST(
  req: NextRequest,
  context: { params: { id: string } },
) {
  try {
    const body = await req.json() as { approvalReceiptId?: string }
    if (!body.approvalReceiptId) {
      return NextResponse.json({ success: false, error: "approvalReceiptId is required" }, { status: 400 })
    }

    const result = await approveAndSendSocialMessage(
      context.params.id,
      body.approvalReceiptId,
    )
    return NextResponse.json({
      success: true,
      data: {
        proposal: result.proposal,
        governance: {
          verifiedUserId: result.verifiedUserId,
          approvalReceiptId: result.approvalReceiptId,
          capability: "consequential.outreach",
        },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Social message approval failed"
    const status =
      message.includes("Authenticated") || message.includes("session") ? 401 :
      message.includes("NOT_FOUND") ? 404 :
      message.includes("APPROVAL") || message.includes("approval") ? 409 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

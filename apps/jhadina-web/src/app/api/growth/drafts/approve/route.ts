import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { runGovernedGrowthDraftApproval } from "@/lib/growth/governed-approval-runtime"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { draftId } = await req.json()
  if (!draftId || typeof draftId !== "string") {
    return NextResponse.json({ success: false, error: "draftId is required" }, { status: 400 })
  }

  try {
    const identityVerifier = await createRequestIdentityVerifier()
    const identity = await identityVerifier.verify({})
    const result = await runGovernedGrowthDraftApproval(identity.userId, draftId, { identityVerifier })
    return NextResponse.json({
      success: true,
      data: {
        draft: result.draft,
        governance: {
          verifiedUserId: result.verifiedUserId,
          approvalReceiptId: result.approvalReceiptId,
        },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approval failed"
    const status =
      message.includes("identity") || message.includes("session") || message.includes("Authenticated")
        ? 401
        : message.includes("not found") ? 404 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

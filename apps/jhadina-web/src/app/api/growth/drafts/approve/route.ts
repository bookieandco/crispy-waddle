import { NextRequest, NextResponse } from "next/server"
import { runGovernedGrowthDraftApproval } from "@/lib/growth/governed-approval-runtime"
import { requireAuthenticatedUserId } from "@/lib/auth/require-authenticated-user"

export const dynamic = "force-dynamic"

/**
 * Spine Proof #1 (Jhadina OS Integration Phase 1): approving a Growth
 * draft now goes through the full governed lifecycle — identity
 * verification, policy evaluation, an explicit approval receipt, and
 * the hardened ActionExecutor — instead of calling the engine directly.
 * Identity is derived only from the server-verified session.
 */
export async function POST(req: NextRequest) {
  const { draftId } = await req.json()

  if (!draftId || typeof draftId !== "string") {
    return NextResponse.json({ success: false, error: "draftId is required" }, { status: 400 })
  }

  try {
    const userId = await requireAuthenticatedUserId()
    const result = await runGovernedGrowthDraftApproval(userId, draftId)
    return NextResponse.json({
      success: true,
      data: {
        draft: result.draft,
        governance: { verifiedUserId: result.verifiedUserId, approvalReceiptId: result.approvalReceiptId },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approval failed"
    const status = message.includes("identity") || message.includes("session") || message.includes("Authenticated") ? 401 : message.includes("not found") ? 404 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

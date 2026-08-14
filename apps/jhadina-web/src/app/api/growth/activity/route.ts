import { NextRequest, NextResponse } from "next/server"
import { listGovernedGrowthActivity } from "@/lib/growth/governed-approval-runtime"

export const dynamic = "force-dynamic"

/**
 * Jhadina OS Integration Phase 2: the Activity Timeline's only way to
 * reach the governed Growth audit ledger. No UI component imports the
 * ledger or governed-approval-runtime directly — this route is the
 * application/service boundary between them, exactly like
 * /api/growth/drafts/approve is the boundary for the write side.
 */
export async function GET(req: NextRequest) {
  const claimedUserId = req.headers.get("x-jhadina-user-id") || "default-user"

  try {
    const { events, verifiedUserId } = await listGovernedGrowthActivity(claimedUserId)
    return NextResponse.json({ success: true, data: { events, verifiedUserId } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load activity"
    const status = message.includes("identity") || message.includes("session") ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

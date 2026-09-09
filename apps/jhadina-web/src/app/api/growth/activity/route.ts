import { NextRequest, NextResponse } from "next/server"
import { listGovernedGrowthActivity } from "@/lib/growth/governed-approval-runtime"

export const dynamic = "force-dynamic"

/**
 * Jhadina OS Integration Phase 2: the Activity Timeline's only way to
 * reach the governed Growth audit ledger. Identity is derived from the
 * verified request session inside the governed runtime; callers cannot
 * select the actor with a request header.
 */
export async function GET(_req: NextRequest) {
  try {
    const { events, verifiedUserId } = await listGovernedGrowthActivity()
    return NextResponse.json({ success: true, data: { events, verifiedUserId } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load activity"
    const status = message.includes("identity") || message.includes("session") ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

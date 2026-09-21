import { NextRequest, NextResponse } from "next/server"
import { requireRequestIdentity } from "@/lib/auth/request-user"
import { scheduleGrowthDraft } from "@/lib/growth/engine"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const identity = await requireRequestIdentity()
    const { draftId, scheduledAt } = await req.json()
    if (!scheduledAt) {
      return NextResponse.json({ success: false, error: "scheduledAt is required" }, { status: 400 })
    }
    const draft = scheduleGrowthDraft(identity.userId, draftId, scheduledAt)
    if (!draft) {
      return NextResponse.json(
        { success: false, error: "Draft must be approved before scheduling" },
        { status: 409 },
      )
    }
    return NextResponse.json({ success: true, data: { draft } })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Authentication required" },
      { status: 401 },
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { scheduleGrowthDraft } from "@/lib/growth/engine"
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { draftId, scheduledAt } = await req.json()
  if (!draftId || typeof draftId !== "string") {
    return NextResponse.json({ success: false, error: "draftId is required" }, { status: 400 })
  }
  if (!scheduledAt) return NextResponse.json({ success: false, error: "scheduledAt is required" }, { status: 400 })

  try {
    const { userId } = await requireAuthenticatedUser()
    const draft = scheduleGrowthDraft(userId, draftId, scheduledAt)
    if (!draft) return NextResponse.json({ success: false, error: "Draft must be approved before scheduling" }, { status: 409 })
    return NextResponse.json({ success: true, data: { draft } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication required"
    return NextResponse.json({ success: false, error: message }, { status: 401 })
  }
}

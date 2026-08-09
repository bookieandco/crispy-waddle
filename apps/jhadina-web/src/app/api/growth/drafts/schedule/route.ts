import { NextRequest, NextResponse } from "next/server"
import { scheduleGrowthDraft } from "@/lib/growth/engine"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { draftId, scheduledAt } = await req.json()
  if (!scheduledAt) return NextResponse.json({ success: false, error: "scheduledAt is required" }, { status: 400 })
  const userId = req.headers.get("x-jhadina-user-id") || "default-user"
  const draft = scheduleGrowthDraft(userId, draftId, scheduledAt)
  if (!draft) return NextResponse.json({ success: false, error: "Draft must be approved before scheduling" }, { status: 409 })
  return NextResponse.json({ success: true, data: { draft } })
}

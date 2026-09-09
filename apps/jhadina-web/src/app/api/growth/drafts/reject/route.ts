import { NextRequest, NextResponse } from "next/server"
import { rejectGrowthDraft } from "@/lib/growth/engine"
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { draftId } = await req.json()
  if (!draftId || typeof draftId !== "string") {
    return NextResponse.json({ success: false, error: "draftId is required" }, { status: 400 })
  }

  try {
    const { userId } = await requireAuthenticatedUser()
    const draft = rejectGrowthDraft(userId, draftId)
    if (!draft) return NextResponse.json({ success: false, error: "Draft not found or not awaiting approval" }, { status: 404 })
    return NextResponse.json({ success: true, data: { draft } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication required"
    return NextResponse.json({ success: false, error: message }, { status: 401 })
  }
}

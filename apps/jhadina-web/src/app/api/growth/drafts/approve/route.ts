import { NextRequest, NextResponse } from "next/server"
import { approveGrowthDraft } from "@/lib/growth/engine"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { draftId } = await req.json()
  const userId = req.headers.get("x-jhadina-user-id") || "default-user"
  const draft = approveGrowthDraft(userId, draftId)

  if (!draft) {
    return NextResponse.json(
      { success: false, error: "Draft not found or not awaiting approval" },
      { status: 404 },
    )
  }

  return NextResponse.json({ success: true, data: { draft } })
}

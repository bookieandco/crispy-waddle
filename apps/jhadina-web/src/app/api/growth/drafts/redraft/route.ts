import { NextRequest, NextResponse } from "next/server"
import { redraftGrowthDraft } from "@/lib/growth/engine"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-jhadina-user-id") || "default-user"
  const body = await req.json()
  if (!body.draftId || !body.instruction) {
    return NextResponse.json({ success: false, error: "draftId and instruction are required" }, { status: 400 })
  }

  const draft = redraftGrowthDraft(userId, body.draftId, body.instruction)
  if (!draft) {
    return NextResponse.json({ success: false, error: "Draft not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: { draft } }, { status: 201 })
}

import { NextRequest, NextResponse } from "next/server"
import { redraftGrowthDraft } from "@/lib/growth/engine"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { draftId, instruction } = await req.json()
  if (typeof instruction !== "string" || !instruction.trim()) {
    return NextResponse.json({ success: false, error: "instruction is required" }, { status: 400 })
  }
  const userId = req.headers.get("x-jhadina-user-id") || "default-user"
  const draft = redraftGrowthDraft(userId, draftId, instruction)
  if (!draft) return NextResponse.json({ success: false, error: "Draft not found" }, { status: 404 })
  return NextResponse.json({ success: true, data: { draft } }, { status: 201 })
}

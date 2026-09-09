import { NextRequest, NextResponse } from "next/server"
import { redraftGrowthDraft } from "@/lib/growth/engine"
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { draftId, instruction } = await req.json()
  if (!draftId || typeof draftId !== "string") {
    return NextResponse.json({ success: false, error: "draftId is required" }, { status: 400 })
  }
  if (typeof instruction !== "string" || !instruction.trim()) {
    return NextResponse.json({ success: false, error: "instruction is required" }, { status: 400 })
  }

  try {
    const { userId } = await requireAuthenticatedUser()
    const draft = redraftGrowthDraft(userId, draftId, instruction)
    if (!draft) return NextResponse.json({ success: false, error: "Draft not found" }, { status: 404 })
    return NextResponse.json({ success: true, data: { draft } }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication required"
    return NextResponse.json({ success: false, error: message }, { status: 401 })
  }
}

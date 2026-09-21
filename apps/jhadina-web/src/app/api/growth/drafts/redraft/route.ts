import { NextRequest, NextResponse } from "next/server"
import { requireRequestIdentity } from "@/lib/auth/request-user"
import { redraftGrowthDraft } from "@/lib/growth/engine"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const identity = await requireRequestIdentity()
    const { draftId, instruction } = await req.json()
    if (typeof instruction !== "string" || !instruction.trim()) {
      return NextResponse.json({ success: false, error: "instruction is required" }, { status: 400 })
    }
    const draft = redraftGrowthDraft(identity.userId, draftId, instruction)
    if (!draft) return NextResponse.json({ success: false, error: "Draft not found" }, { status: 404 })
    return NextResponse.json({ success: true, data: { draft } }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Authentication required" },
      { status: 401 },
    )
  }
}

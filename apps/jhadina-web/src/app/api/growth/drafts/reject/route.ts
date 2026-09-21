import { NextRequest, NextResponse } from "next/server"
import { requireRequestIdentity } from "@/lib/auth/request-user"
import { rejectGrowthDraft } from "@/lib/growth/engine"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const identity = await requireRequestIdentity()
    const { draftId } = await req.json()
    const draft = rejectGrowthDraft(identity.userId, draftId)
    if (!draft) {
      return NextResponse.json(
        { success: false, error: "Draft not found or not awaiting approval" },
        { status: 404 },
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

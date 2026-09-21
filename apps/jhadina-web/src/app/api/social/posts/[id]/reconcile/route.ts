import { NextResponse } from "next/server"
import { reconcileSocialProposal } from "@/lib/social/governed-publication"

export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  context: { params: { id: string } },
) {
  try {
    const proposal = await reconcileSocialProposal(context.params.id)
    return NextResponse.json({ success: true, data: { proposal } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Social reconciliation failed"
    const status = message.includes("Authenticated") || message.includes("session") ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

import { NextResponse } from "next/server"
import { reconcileSocialMessage } from "@/lib/social/governed-messaging"

export const dynamic = "force-dynamic"

export async function POST(
  _request: Request,
  context: { params: { id: string } },
) {
  try {
    const proposal = await reconcileSocialMessage(context.params.id)
    return NextResponse.json({ success: true, data: { proposal } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Social message reconciliation failed"
    const status = message.includes("Authenticated") || message.includes("session") ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

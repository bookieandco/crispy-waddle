import { NextRequest, NextResponse } from "next/server"
import { approveSocialCalendarBatch } from "@/lib/social/calendar-batch"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      batchId?: string
      proposalIds?: string[]
    }
    if (!body.batchId?.trim() || !Array.isArray(body.proposalIds) || body.proposalIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: "batchId and proposalIds are required",
      }, { status: 400 })
    }

    const result = await approveSocialCalendarBatch({
      batchId: body.batchId,
      proposalIds: body.proposalIds,
    })

    return NextResponse.json({
      success: result.status !== "failed",
      data: result,
    }, { status: result.status === "failed" ? 409 : 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to approve social calendar batch"
    const status = message.includes("Authenticated") || message.includes("session") ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

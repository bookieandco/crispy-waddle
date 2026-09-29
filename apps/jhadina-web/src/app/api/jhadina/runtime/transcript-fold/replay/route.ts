import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { drainTranscriptFoldLearningEvents } from "@/lib/runtime/transcript-fold-learning-consumer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ReplayBody = {
  workSessionId?: string
  limit?: number
}

export async function POST(req: NextRequest) {
  try {
    const verifier = await createRequestIdentityVerifier()
    const identity = await verifier.verify({})
    const body = await req.json() as ReplayBody
    const workSessionId = body.workSessionId?.trim() ?? ""
    if (!workSessionId) {
      return NextResponse.json(
        { success: false, error: "workSessionId is required" },
        { status: 400 },
      )
    }

    const result = await drainTranscriptFoldLearningEvents({
      userId: identity.userId,
      workSessionId,
      limit: body.limit,
    })

    return NextResponse.json({
      success: true,
      data: {
        consumer: "transcript-fold-learning-v1",
        ...result,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to replay transcript-fold events"
    const status = /Authenticated|identity|session/i.test(message)
      ? 401
      : /NOT_FOUND/.test(message)
        ? 404
        : /REQUIRED|INVALID/.test(message)
          ? 400
          : 503
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

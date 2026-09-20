import { NextResponse } from "next/server"
import { observeShodanGoverned } from "@/lib/intelligence/governed-observation-runtime"
import { parseShodanObservationRequest } from "@/lib/intelligence/shodan-observation-request"

export async function POST(request: Request) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "valid JSON body required" }, { status: 400 })
  }

  let value
  try {
    value = parseShodanObservationRequest(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid passive observation request"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    const claimedUserId = request.headers.get("x-jhadina-user-id") ?? undefined
    const result = await observeShodanGoverned({
      claimedUserId,
      observationId: value.observationId,
      subjectId: value.subjectId,
      capability: value.capability,
      observedAt: value.observedAt,
    })
    return NextResponse.json({ ok: true, observation: result.envelope, verifiedUserId: result.verifiedUserId })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to perform passive observation"
    const status = /identity|session|auth/i.test(message) ? 401 : /credential/i.test(message) ? 503 : 502
    return NextResponse.json({ error: message }, { status })
  }
}

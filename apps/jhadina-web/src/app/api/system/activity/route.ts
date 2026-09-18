import { NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { listJhadinaActivity } from "@/lib/system/activity"

export async function GET(request: Request) {
  const claimedUserId = request.headers.get("x-jhadina-user-id")
  if (!claimedUserId) {
    return NextResponse.json({ error: "x-jhadina-user-id is required" }, { status: 401 })
  }

  try {
    const identity = createRequestIdentityVerifier(request)
    const verifiedUserId = await identity.verify(claimedUserId)
    const events = await listJhadinaActivity(verifiedUserId)
    return NextResponse.json({ ok: true, events })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to read activity" },
      { status: 403 },
    )
  }
}

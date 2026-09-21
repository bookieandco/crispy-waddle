import { NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { listGovernedGrowthActivity } from "@/lib/growth/governed-approval-runtime"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const identityVerifier = await createRequestIdentityVerifier()
    const identity = await identityVerifier.verify({})
    const { events, verifiedUserId } = await listGovernedGrowthActivity(identity.userId, { identityVerifier })
    return NextResponse.json({ success: true, data: { events, verifiedUserId } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load activity"
    const status =
      message.includes("identity") || message.includes("session") || message.includes("Authenticated")
        ? 401
        : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

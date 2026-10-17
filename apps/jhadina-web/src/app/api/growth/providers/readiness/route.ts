import { NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { buildAdsConnectionReadiness, isAdsReadinessOwner } from "@/lib/growth/ads-connection-readiness"

export const dynamic = "force-dynamic"

/**
 * Owner-session-only metadata probe. Neither this route nor its helper
 * performs provider calls, ad writes, token reads, or spend authorization.
 */
export async function GET() {
  try {
    const identity = await (await createRequestIdentityVerifier()).verify({})
    const operatorId = process.env.JHADINA_ADS_OWNER_USER_ID?.trim()
    if (!operatorId) return NextResponse.json(
      { success: false, error: "ADS_OWNER_NOT_CONFIGURED" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
    if (!isAdsReadinessOwner(identity.userId, operatorId)) return NextResponse.json(
      { success: false, error: "FORBIDDEN" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json(
      { success: false, error: "UNAUTHORIZED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }

  return NextResponse.json(
    { success: true, data: buildAdsConnectionReadiness(process.env) },
    { headers: { "Cache-Control": "no-store" } },
  )
}

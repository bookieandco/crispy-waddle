import { NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { buildAdsConnectionReadiness } from "@/lib/growth/ads-connection-readiness"

export const dynamic = "force-dynamic"

/**
 * Owner-session-only metadata probe. Neither this route nor its helper
 * performs provider calls, ad writes, token reads, or spend authorization.
 */
export async function GET() {
  try {
    await (await createRequestIdentityVerifier()).verify({})
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

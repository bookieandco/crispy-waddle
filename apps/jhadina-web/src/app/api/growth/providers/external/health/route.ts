import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { isAdsReadinessOwner } from "@/lib/growth/ads-connection-readiness"
import { probeEtsyPublicShop, probeRedditAdsAccount } from "@/lib/growth/external-ads-probes"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "no-store" }

/** Authenticated, exact-owner, GET-only read evidence. No provider writes. */
export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = (await (await createRequestIdentityVerifier()).verify({})).userId
  } catch {
    return NextResponse.json({ success: false, status: "UNAUTHORIZED" }, { status: 401, headers })
  }
  const ownerId = process.env.JHADINA_ADS_OWNER_USER_ID?.trim()
  if (!ownerId) return NextResponse.json(
    { success: false, status: "OWNER_NOT_COMMISSIONED" }, { status: 503, headers },
  )
  if (!isAdsReadinessOwner(userId, ownerId)) {
    return NextResponse.json({ success: false, status: "FORBIDDEN" }, { status: 403, headers })
  }
  const provider = req.nextUrl.searchParams.get("platform")
  if (provider !== "etsy" && provider !== "reddit_ads") {
    return NextResponse.json(
      { success: false, status: "PLATFORM_NOT_SUPPORTED" }, { status: 400, headers },
    )
  }
  const isEtsy = provider === "etsy"
  const configured = isEtsy
    ? Boolean(process.env.ETSY_API_KEY?.trim() && process.env.ETSY_SHOP_ID?.trim())
    : Boolean(process.env.REDDIT_ADS_ACCESS_TOKEN?.trim() && process.env.REDDIT_ADS_ACCOUNT_ID?.trim())

  // Never silently turn a status read into external network traffic.
  if (req.nextUrl.searchParams.get("probe") !== "1") {
    return NextResponse.json({
      success: true, platform: provider, configured,
      status: configured ? "CREDENTIALS_PRESENT_NOT_VERIFIED" : "NOT_CONFIGURED",
      launchAuthorized: false, spendAuthorized: false,
    }, { headers })
  }
  if (!configured) {
    return NextResponse.json({
      success: false, platform: provider, status: "NOT_CONFIGURED",
      launchAuthorized: false, spendAuthorized: false,
    }, { status: 503, headers })
  }

  try {
    const proof = isEtsy
      ? await probeEtsyPublicShop({
          apiKey: process.env.ETSY_API_KEY!,
          shopId: process.env.ETSY_SHOP_ID!,
        })
      : await probeRedditAdsAccount({
          token: process.env.REDDIT_ADS_ACCESS_TOKEN!,
          accountId: process.env.REDDIT_ADS_ACCOUNT_ID!,
        })
    return NextResponse.json({
      success: true, platform: provider, configured: true, status: "READ_ONLY_VERIFIED",
      proof, launchAuthorized: false, spendAuthorized: false,
    }, { headers })
  } catch {
    // Do not return tokens, provider bodies, resource IDs or authentication errors.
    return NextResponse.json({
      success: false, platform: provider, status: "READ_PROBE_FAILED",
      launchAuthorized: false, spendAuthorized: false,
    }, { status: 503, headers })
  }
}

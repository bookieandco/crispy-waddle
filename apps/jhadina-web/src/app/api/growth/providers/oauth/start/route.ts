import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { isAdsReadinessOwner } from "@/lib/growth/ads-connection-readiness"
import {
  adsOAuthAuthorizeUrl, adsOAuthSettings, sealAdsOAuthSession,
  type AdsOAuthPlatform,
} from "@/lib/growth/ads-readonly-oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
const cookieName = "jhadina_ads_oauth_pending"

async function ownerId() {
  const identity = await (await createRequestIdentityVerifier()).verify({})
  return identity.userId
}

function available(req: NextRequest, platform: AdsOAuthPlatform): boolean {
  const secret = process.env.ADS_OAUTH_SESSION_SECRET?.trim() ?? ""
  return secret.length >= 32 && Boolean(adsOAuthSettings(process.env, platform, req.nextUrl.origin))
}

/** Status does not make provider calls, disclose account IDs, or initiate OAuth. */
export async function GET(req: NextRequest) {
  let userId: string
  try { userId = await ownerId() } catch {
    return NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401, headers })
  }
  const expectedOwner = process.env.JHADINA_ADS_OWNER_USER_ID?.trim()
  if (!expectedOwner) return NextResponse.json({ status: "OWNER_NOT_CONFIGURED" }, { status: 503, headers })
  if (!isAdsReadinessOwner(userId, expectedOwner)) {
    return NextResponse.json({ status: "FORBIDDEN" }, { status: 403, headers })
  }
  return NextResponse.json({
    status: "READ_ONLY_OAUTH_CONFIGURATION",
    providers: {
      etsy: { readyToAuthorize: available(req, "etsy"), scope: "shops_r" },
      reddit_ads: { readyToAuthorize: available(req, "reddit_ads"), scope: "adsread" },
    },
    tokensPersisted: false, spendAuthorized: false, launchAuthorized: false,
  }, { headers })
}

/** Owner click is required. This response cannot authorize any ad spend. */
export async function POST(req: NextRequest) {
  let userId: string
  try { userId = await ownerId() } catch {
    return NextResponse.json({ status: "UNAUTHORIZED" }, { status: 401, headers })
  }
  const expectedOwner = process.env.JHADINA_ADS_OWNER_USER_ID?.trim()
  if (!expectedOwner) return NextResponse.json({ status: "OWNER_NOT_CONFIGURED" }, { status: 503, headers })
  if (!isAdsReadinessOwner(userId, expectedOwner)) {
    return NextResponse.json({ status: "FORBIDDEN" }, { status: 403, headers })
  }
  let platform: AdsOAuthPlatform
  try {
    const body = await req.json() as { platform?: string }
    if (body.platform !== "etsy" && body.platform !== "reddit_ads") throw new Error("unsupported")
    platform = body.platform
  } catch {
    return NextResponse.json({ status: "INVALID_PLATFORM" }, { status: 400, headers })
  }
  const config = adsOAuthSettings(process.env, platform, req.nextUrl.origin)
  const secret = process.env.ADS_OAUTH_SESSION_SECRET?.trim() ?? ""
  if (!config || secret.length < 32) {
    return NextResponse.json({ status: "OAUTH_NOT_CONFIGURED" }, { status: 503, headers })
  }
  const { authorizeUrl, pending } = adsOAuthAuthorizeUrl(config, userId)
  const res = NextResponse.json({
    status: "OWNER_CONSENT_REQUIRED", platform, authorizeUrl,
    readOnly: true, tokensPersisted: false, spendAuthorized: false,
  }, { headers })
  res.cookies.set(cookieName, sealAdsOAuthSession(pending, secret), {
    httpOnly: true, secure: req.nextUrl.protocol === "https:",
    sameSite: "lax", path: "/api/growth/providers/oauth",
    maxAge: 600,
  })
  return res
}

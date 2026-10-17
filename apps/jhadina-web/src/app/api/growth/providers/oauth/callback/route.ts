import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { isAdsReadinessOwner } from "@/lib/growth/ads-connection-readiness"
import {
  adsOAuthSettings, assertAdsOAuthCallback, finishAdsOAuthReadCanary, unsealAdsOAuthSession,
} from "@/lib/growth/ads-readonly-oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const cookieName = "jhadina_ads_oauth_pending"
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }

function back(req: NextRequest, result: "verified-temporary" | "failed" | "denied") {
  const url = new URL("/growth/ads/connect", req.nextUrl.origin)
  url.searchParams.set("oauth", result)
  const res = NextResponse.redirect(url, { status: 303, headers })
  res.cookies.set(cookieName, "", {
    maxAge: 0, httpOnly: true, secure: req.nextUrl.protocol === "https:",
    sameSite: "lax", path: "/api/growth/providers/oauth",
  })
  return res
}

/**
 * A read-only OAuth canary: validates user + state + PKCE/scope + target,
 * then discards all tokens. Never stores refresh tokens or launches campaigns.
 * Durable account connection requires recovering canonical encrypted storage.
 */
export async function GET(req: NextRequest) {
  try {
    const identity = await (await createRequestIdentityVerifier()).verify({})
    const expectedOwner = process.env.JHADINA_ADS_OWNER_USER_ID?.trim()
    if (!expectedOwner || !isAdsReadinessOwner(identity.userId, expectedOwner)) return back(req, "failed")
    const secret = process.env.ADS_OAUTH_SESSION_SECRET?.trim() ?? ""
    const pending = unsealAdsOAuthSession(req.cookies.get(cookieName)?.value, secret)
    const config = adsOAuthSettings(process.env, pending.platform, req.nextUrl.origin)
    if (!config) return back(req, "failed")
    assertAdsOAuthCallback(pending, req.nextUrl.searchParams.get("state"), pending.platform, identity.userId)
    if (req.nextUrl.searchParams.has("error")) return back(req, "denied")
    const code = req.nextUrl.searchParams.get("code") ?? ""
    await finishAdsOAuthReadCanary({ config, session: pending, code })
    return back(req, "verified-temporary")
  } catch {
    return back(req, "failed")
  }
}

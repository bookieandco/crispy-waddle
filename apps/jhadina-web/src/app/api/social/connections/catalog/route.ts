import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createSocialRepository } from "@/lib/social/repository"
import { buildSocialConnectionReadiness } from "@/lib/social/connection-readiness"

export const dynamic = "force-dynamic"
const HEADERS = { "Cache-Control": "private, no-store" }

const direct = [
  { id: "facebook", label: "Facebook Pages", state: "official_oauth_not_configured", mode: "owner_oauth", details: "Meta App and Page permission review required." },
  { id: "instagram", label: "Instagram", state: "official_oauth_not_configured", mode: "owner_oauth", details: "Official API works with professional Creator or Business accounts." },
  { id: "tiktok", label: "TikTok", state: "official_oauth_not_configured", mode: "owner_oauth", details: "TikTok developer app and approved login scopes required." },
  { id: "x", label: "X", state: "official_oauth_not_configured", mode: "owner_oauth", details: "Developer approval and an authorized API integration required." },
  { id: "linkedin", label: "LinkedIn", state: "official_oauth_not_configured", mode: "owner_oauth", details: "Official OAuth and appropriate API product permissions required." },
  { id: "threads", label: "Threads", state: "official_oauth_not_configured", mode: "owner_oauth", details: "Official Threads permissions required." },
] as const

export async function GET() {
  let owner: string
  try {
    owner = (await (await createRequestIdentityVerifier()).verify({})).userId
    if (!owner) throw new Error("NO_OWNER")
  } catch {
    return NextResponse.json({ success: false, error: "Sign in to review providers." }, { status: 401, headers: HEADERS })
  }
  try {
    const accounts = await createSocialRepository().listAccounts(owner)
    const aggregators = buildSocialConnectionReadiness(owner, accounts, process.env)
    const youtubeConfigured = !!(process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() && process.env.JHADINA_OAUTH_ENCRYPTION_KEY?.trim())
    const cookieJar = cookies()
    const youtubeCookiePresent = !!cookieJar.get("jhadina_youtube_access")?.value
    return NextResponse.json({
      success: true,
      data: {
        aggregators,
        publicFeeds: [
          { id: "github", label: "GitHub activity", state: "public_read_available" },
          { id: "youtube", label: "YouTube public channel", state: "public_read_available" },
          { id: "wordpress", label: "WordPress.com", state: "public_read_available" },
        ],
        youtube: {
          id: "youtube-oauth", label: "YouTube private account",
          state: !youtubeConfigured ? "developer_setup_required" :
            youtubeCookiePresent ? "browser_credential_present_unverified" : "owner_consent_available",
          mode: "existing_read_only_oauth",
          connectPath: youtubeConfigured ? "/api/auth/youtube/start" : null,
          verifiedProfile: false, authorizedToPublish: false,
        },
        direct,
        feedPersistence: false,
        socialPublishingCommissioned: false,
      },
    }, { headers: HEADERS })
  } catch {
    return NextResponse.json({ success: false, error: "Provider status is unavailable." },
      { status: 503, headers: HEADERS })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { requireRequestIdentity } from "@/lib/auth/request-user"
import { searchTikTokTrends } from "@/lib/growth/tiktokTrendProvider"
import { proposalFromScout } from "@/lib/growth/trendScoutWorker"
import { scoreTikTokVelocity } from "@/lib/growth/tiktokVelocity"
import { persistSocialTrendObservations } from "@/lib/social/trend-observation"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const identity = await requireRequestIdentity()
    const body = await req.json().catch(() => ({}))
    const query = typeof body.query === "string" && body.query.trim() ? body.query.trim() : null
    if (!query) return NextResponse.json({ success: false, error: "query is required" }, { status: 400 })

    const observations = await searchTikTokTrends({
      query,
      country: typeof body.country === "string" ? body.country : undefined,
      maxPages: typeof body.maxPages === "number" ? body.maxPages : 1,
    })
    const persistedSocialObservations = await persistSocialTrendObservations(identity.userId, "tikapi", observations)
    const proposal = observations.length ? proposalFromScout(observations) : null
    const velocity = scoreTikTokVelocity(observations)

    return NextResponse.json({
      success: true,
      data: { source: "tiktok", observations, persistedSocialObservations, velocity, proposal, originalityRule: "INSPIRED_NOT_COPIED" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "TikTok trend scout failed"
    const status = message.includes("Authenticated") || message.includes("session") ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

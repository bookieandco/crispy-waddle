import { NextRequest, NextResponse } from "next/server"
import { searchTikTokTrends } from "@/lib/growth/tiktokTrendProvider"
import { proposalFromScout } from "@/lib/growth/trendScoutWorker"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const query = typeof body.query === "string" && body.query.trim() ? body.query.trim() : null
    if (!query) return NextResponse.json({ success: false, error: "query is required" }, { status: 400 })

    const observations = await searchTikTokTrends({
      query,
      country: typeof body.country === "string" ? body.country : undefined,
      maxPages: typeof body.maxPages === "number" ? body.maxPages : 1,
    })
    const proposal = observations.length ? proposalFromScout(observations) : null

    return NextResponse.json({
      success: true,
      data: {
        source: "tiktok",
        observations,
        proposal,
        originalityRule: "INSPIRED_NOT_COPIED",
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "TikTok trend scout failed",
    }, { status: 500 })
  }
}

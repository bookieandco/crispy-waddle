import { NextRequest, NextResponse } from "next/server"
import { requireRequestIdentity } from "@/lib/auth/request-user"
import { searchViaAgentReach } from "@/lib/growth/agentReachProvider"
import type { TrendSource } from "@/lib/growth/trendScout"
import { proposalFromScout } from "@/lib/growth/trendScoutWorker"
import { searchWebTrends } from "@/lib/growth/webTrendProvider"
import { persistSocialTrendObservations } from "@/lib/social/trend-observation"

export const dynamic = "force-dynamic"

const DEFAULT_QUERIES = [
  "JhadinaTV video trends storytelling",
  "short form video hooks cinematic storytelling",
  "YouTube creator trends film storytelling",
]

export async function POST(req: NextRequest) {
  try {
    const identity = await requireRequestIdentity()
    const body = await req.json().catch(() => ({}))
    const queries = Array.isArray(body.queries) && body.queries.length ? body.queries : DEFAULT_QUERIES
    const provider = body.provider === "agent-reach" ? "agent-reach" : "web"
    const sources = Array.isArray(body.sources) ? body.sources as TrendSource[] : undefined

    const observations = (await Promise.all(
      queries.map((query: string) =>
        provider === "agent-reach"
          ? searchViaAgentReach({ query, sources })
          : searchWebTrends({ query, freshnessDays: 7 }),
      ),
    )).flat()

    const persistedSocialObservations = await persistSocialTrendObservations(identity.userId, provider, observations)
    const proposal = observations.length ? proposalFromScout(observations) : null
    return NextResponse.json({
      success: true,
      data: { provider, observations, persistedSocialObservations, proposal, originalityRule: "INSPIRED_NOT_COPIED" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Trend scout failed"
    const status = message.includes("Authenticated") || message.includes("session") ? 401 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

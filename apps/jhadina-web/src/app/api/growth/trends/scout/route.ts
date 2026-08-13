import { NextRequest, NextResponse } from "next/server"
import { searchWebTrends } from "@/lib/growth/webTrendProvider"
import { proposalFromScout } from "@/lib/growth/trendScoutWorker"

export const dynamic = "force-dynamic"

const DEFAULT_QUERIES = [
  "JhadinaTV video trends storytelling",
  "short form video hooks cinematic storytelling",
  "YouTube creator trends film storytelling",
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const queries = Array.isArray(body.queries) && body.queries.length ? body.queries : DEFAULT_QUERIES
    const observations = (await Promise.all(queries.map((query: string) => searchWebTrends({ query, freshnessDays: 7 })))).flat()
    const proposal = proposalFromScout(observations)
    return NextResponse.json({ success: true, data: { observations, proposal } })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Trend scout failed" }, { status: 500 })
  }
}

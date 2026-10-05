import { NextRequest, NextResponse } from "next/server"
import { getRecoverySearchHealth } from "@/lib/research/source-discovery-health"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function authorized(request: NextRequest): boolean {
  const secret = process.env.JHADINA_INTERNAL_RESEARCH_SECRET || process.env.CRON_SECRET
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`)
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const health = getRecoverySearchHealth()

  return NextResponse.json({
    ok: true,
    schema: "jhadina.research.recovery-source-health.v1",
    authority: "HEALTH_ONLY",
    ...health,
  })
}

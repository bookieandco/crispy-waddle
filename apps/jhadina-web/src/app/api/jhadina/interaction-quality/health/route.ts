import { NextResponse } from "next/server"
import { checkInteractionQualityProductionHealth } from "@/lib/context/interaction-quality-production-health"

export const dynamic = "force-dynamic"

export async function GET() {
  const health = checkInteractionQualityProductionHealth()
  return NextResponse.json(health, {
    status: health.status === "READY" ? 200 : 503,
    headers: { "cache-control": "no-store" },
  })
}

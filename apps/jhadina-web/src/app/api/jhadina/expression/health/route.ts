import { NextResponse } from "next/server"
import { checkExpressionProductionHealth } from "@/lib/context/expression-production-health"

export const dynamic = "force-dynamic"

export async function GET() {
  const health = await checkExpressionProductionHealth()
  return NextResponse.json(health, {
    status: health.status === "READY" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  })
}

import { NextRequest, NextResponse } from "next/server"
import { listOpportunities } from "@/lib/opportunities/engine"
import { rankSideIncomeOpportunities } from "@/lib/opportunities/sideIncome"

export const dynamic = "force-dynamic"

function userId(req: NextRequest) {
  return req.headers.get("x-jhadina-user-id") || "default-user"
}

/**
 * OCE-5.2 compatibility boundary.
 * The UI/API remains stable while legacy records are projected into the
 * canonical queue contract. Source migration can happen incrementally.
 */
export async function GET(req: NextRequest) {
  const opportunities = listOpportunities(userId(req))
  const ranked = rankSideIncomeOpportunities(opportunities)
  return NextResponse.json({
    success: true,
    data: {
      opportunities: ranked,
      source: "canonical-opportunity-queue-compatible",
    },
  })
}

export { POST } from "./post"

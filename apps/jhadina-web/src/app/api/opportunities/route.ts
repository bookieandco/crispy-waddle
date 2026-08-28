import { NextRequest, NextResponse } from "next/server"
import { createOpportunity } from "@/lib/opportunities/engine"
import { getMoneyCommandCenterSnapshot } from "@/lib/opportunities/canonicalQueue"
import type { AutomationLevel, OpportunityKind } from "@/lib/opportunities/sideIncome"

export const dynamic = "force-dynamic"

function userId(req: NextRequest) {
  return req.headers.get("x-jhadina-user-id") || "default-user"
}

/** OCE-5.2b: canonical queue-backed read boundary. Legacy writes remain compatible. */
export async function GET(req: NextRequest) {
  const snapshot = getMoneyCommandCenterSnapshot(userId(req))
  return NextResponse.json({ success: true, data: snapshot })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const opportunity = createOpportunity({
    userId: userId(req), title: body.title, kind: body.kind as OpportunityKind,
    sourceUrl: body.sourceUrl, sourceName: body.sourceName, summary: body.summary,
    estimatedPay: body.estimatedPay, startupCost: body.startupCost, estimatedHours: body.estimatedHours,
    automationLevel: body.automationLevel as AutomationLevel, fitScore: body.fitScore,
    riskFlags: body.riskFlags, deadline: body.deadline, requiresUserApproval: body.requiresUserApproval,
  })
  return NextResponse.json({ success: true, data: { opportunity } }, { status: 201 })
}

import { NextResponse } from "next/server"
import { createOpportunity, listOpportunities } from "@/lib/opportunities/engine"
import { rankSideIncomeOpportunities } from "@/lib/opportunities/sideIncome"
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user"
import type { AutomationLevel, OpportunityKind } from "@/lib/opportunities/sideIncome"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { userId } = await requireAuthenticatedUser()
    const ranked = rankSideIncomeOpportunities(listOpportunities(userId))
    return NextResponse.json({ success: true, data: { opportunities: ranked } })
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await requireAuthenticatedUser()
    const body = await req.json()
    const opportunity = createOpportunity({
      userId,
      title: body.title,
      kind: body.kind as OpportunityKind,
      sourceUrl: body.sourceUrl,
      sourceName: body.sourceName,
      summary: body.summary,
      estimatedPay: body.estimatedPay,
      startupCost: body.startupCost,
      estimatedHours: body.estimatedHours,
      automationLevel: body.automationLevel as AutomationLevel,
      fitScore: body.fitScore,
      riskFlags: body.riskFlags,
      deadline: body.deadline,
      requiresUserApproval: body.requiresUserApproval,
    })
    return NextResponse.json({ success: true, data: { opportunity } }, { status: 201 })
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
}

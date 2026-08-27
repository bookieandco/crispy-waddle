import { NextRequest, NextResponse } from "next/server"
import { createOpportunity, listOpportunities } from "@/lib/opportunities/engine"
import { rankSideIncomeOpportunities } from "@/lib/opportunities/sideIncome"
import type { AutomationLevel, OpportunityKind } from "@/lib/opportunities/sideIncome"
import { searchSamOpportunities } from "@/lib/money-opportunities/sam-client"
import { rankSamOpportunities } from "@/lib/money-opportunities/sam-ranking"
import { estimateOpportunityEconomics } from "@/lib/money-opportunities/economics"
import { buildMoneyActionQueue } from "@/lib/money-opportunities/action-queue"

export const dynamic = "force-dynamic"

function userId(req: NextRequest) {
  return req.headers.get("x-jhadina-user-id") || "default-user"
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams

  if (params.get("source") === "sam") {
    try {
      const result = await searchSamOpportunities({
        keyword: params.get("keyword") || undefined,
        postedFrom: params.get("postedFrom") || undefined,
        postedTo: params.get("postedTo") || undefined,
        noticeType: params.get("noticeType") || undefined,
        typeOfSetAside: params.get("typeOfSetAside") || undefined,
        limit: Number(params.get("limit") || 25),
        offset: Number(params.get("offset") || 0),
      })

      const ranked = rankSamOpportunities(result.opportunities)
      const actionQueue = buildMoneyActionQueue(
        ranked.map(({ opportunity, score }) => ({
          opportunity,
          score,
          economics: estimateOpportunityEconomics(opportunity, {
            directCostPercent: 35,
            overheadPercent: 10,
            contingencyPercent: 5,
          }),
        })),
      )

      return NextResponse.json({
        success: true,
        source: "sam.gov",
        data: {
          opportunities: ranked,
          actionQueue,
          totalRecords: result.totalRecords,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "SAM.gov request failed"
      const status = message.includes("not configured") ? 503 : 502
      return NextResponse.json({ success: false, error: message }, { status })
    }
  }

  const ranked = rankSideIncomeOpportunities(listOpportunities(userId(req)))
  return NextResponse.json({ success: true, data: { opportunities: ranked } })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const opportunity = createOpportunity({
    userId: userId(req),
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
}

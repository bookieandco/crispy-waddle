import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createGrowthProductionRepository } from "@/lib/growth/production-repository"
import { requestPaidCampaign } from "@/lib/growth/governed-paid-campaign"
import type { PaidMediaChannel } from "@jhadina/growth-core"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const identity = await (await createRequestIdentityVerifier()).verify({})
    const campaigns = await createGrowthProductionRepository().listPaidCampaigns(identity.userId)
    return NextResponse.json({ success: true, data: campaigns })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load paid campaigns" }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      brandId?: string; name?: string; objective?: string; channel?: PaidMediaChannel; provider?: string
      providerAccountId?: string; audienceIds?: string[]; creativeIds?: string[]; landingPageId?: string
      currency?: string; dailyBudgetMinor?: number; lifetimeBudgetMinor?: number; startsAt?: string; endsAt?: string
      idempotencyKey?: string
    }
    if (!body.brandId || !body.name || !body.objective || !body.channel || !body.providerAccountId || !body.currency) {
      return NextResponse.json({ success: false, error: "brandId, name, objective, channel, providerAccountId, and currency are required" }, { status: 400 })
    }
    if (!body.audienceIds?.length || !body.creativeIds?.length || !Number.isInteger(body.dailyBudgetMinor)) {
      return NextResponse.json({ success: false, error: "audienceIds, creativeIds, and integer dailyBudgetMinor are required" }, { status: 400 })
    }
    const result = await requestPaidCampaign({
      brandId: body.brandId, name: body.name, objective: body.objective, channel: body.channel,
      provider: body.provider, providerAccountId: body.providerAccountId, audienceIds: body.audienceIds,
      creativeIds: body.creativeIds, landingPageId: body.landingPageId, currency: body.currency,
      dailyBudgetMinor: body.dailyBudgetMinor!, lifetimeBudgetMinor: body.lifetimeBudgetMinor,
      startsAt: body.startsAt, endsAt: body.endsAt, idempotencyKey: body.idempotencyKey,
    })
    return NextResponse.json({
      success: true,
      data: { campaign: result.campaign, approval: { required: true, receiptId: result.approvalReceiptId } },
    }, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create paid campaign proposal"
    const status = message.includes("Authenticated") || message.includes("session") ? 401 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

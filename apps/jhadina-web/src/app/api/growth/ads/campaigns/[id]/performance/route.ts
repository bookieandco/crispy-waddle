import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createGrowthProductionRepository } from "@/lib/growth/production-repository"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest, context: { params: { id: string } }) {
  try {
    const identity = await (await createRequestIdentityVerifier()).verify({})
    const repository = createGrowthProductionRepository()
    await repository.getPaidCampaign(identity.userId, context.params.id)
    const body = await req.json() as {
      observationKey?: string; source?: string; observedAt?: string; metrics?: Record<string, unknown>; evidence?: Record<string, unknown>; confidence?: number
    }
    if (!body.observationKey || !body.source || !body.metrics) return NextResponse.json({ success: false, error: "observationKey, source, and metrics are required" }, { status: 400 })
    const observation = await repository.recordProviderObservation({
      observationKey: body.observationKey, campaignId: context.params.id, source: body.source, observedAt: body.observedAt ?? new Date().toISOString(),
      metrics: body.metrics, evidence: body.evidence, confidence: body.confidence,
    })
    return NextResponse.json({ success: true, data: observation })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record campaign performance"
    return NextResponse.json({ success: false, error: message }, { status: message.includes("Authenticated") ? 401 : 400 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createGrowthProductionRepository } from "@/lib/growth/production-repository"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    await (await createRequestIdentityVerifier()).verify({})
    const body = await req.json() as {
      eventKey?: string; brandId?: string; customerKey?: string; eventType?: string; occurredAt?: string; source?: string
      productId?: string; value?: number; currency?: string; confidence?: number; evidence?: Record<string, unknown>
    }
    if (!body.eventKey || !body.brandId || !body.customerKey || !body.eventType || !body.source) {
      return NextResponse.json({ success: false, error: "eventKey, brandId, customerKey, eventType, and source are required" }, { status: 400 })
    }
    const event = await createGrowthProductionRepository().recordCustomerEvent({
      eventKey: body.eventKey, brandId: body.brandId, customerKey: body.customerKey, eventType: body.eventType,
      occurredAt: body.occurredAt ?? new Date().toISOString(), source: body.source, productId: body.productId,
      value: body.value, currency: body.currency, confidence: body.confidence, evidence: body.evidence,
    })
    return NextResponse.json({ success: true, data: event }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record customer event"
    return NextResponse.json({ success: false, error: message }, { status: message.includes("Authenticated") ? 401 : 400 })
  }
}

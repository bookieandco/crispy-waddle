import { NextResponse } from "next/server"
import {
  assessRecurringOffer,
  createCommercialValidationTest,
  createMarketLearning,
  createOfferCanvas,
  createProofSprint,
} from "@jhadina/opportunity-core"
import { createClient } from "@/lib/supabase/server"
import {
  createSupabaseOpportunityRepository,
  type CommercialLearningKind,
  type StoredCommercialLearningRecord,
} from "@/lib/opportunities/supabase-opportunity-repository"

export const dynamic = "force-dynamic"

type CommercialBody = {
  kind?: CommercialLearningKind
  recordId?: string
  recordedAt?: string
  payload?: Record<string, unknown>
}

async function authenticated() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(
  _req: Request,
  context: { params: { id: string } },
) {
  const user = await authenticated()
  if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })

  try {
    const repository = createSupabaseOpportunityRepository()
    const opportunity = await repository.get(context.params.id)
    if (!opportunity) return NextResponse.json({ success: false, error: "Opportunity not found" }, { status: 404 })
    const records = await repository.listCommercialLearning(context.params.id)
    return NextResponse.json({ success: true, data: { records } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load commercial learning"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

export async function POST(
  req: Request,
  context: { params: { id: string } },
) {
  const user = await authenticated()
  if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })

  try {
    const body = await req.json() as CommercialBody
    if (!body.kind || !body.payload) {
      return NextResponse.json({ success: false, error: "kind and payload are required" }, { status: 400 })
    }

    const repository = createSupabaseOpportunityRepository()
    const opportunity = await repository.get(context.params.id)
    if (!opportunity) return NextResponse.json({ success: false, error: "Opportunity not found" }, { status: 404 })

    let record: StoredCommercialLearningRecord
    const recordedAt = body.recordedAt ?? new Date().toISOString()

    switch (body.kind) {
      case "offer_canvas": {
        const payload = createOfferCanvas({
          ...(body.payload as Parameters<typeof createOfferCanvas>[0]),
          opportunityId: context.params.id,
        })
        record = { id: payload.id, opportunityId: context.params.id, kind: body.kind, payload, recordedAt }
        break
      }
      case "validation_test": {
        const payload = createCommercialValidationTest({
          ...(body.payload as Parameters<typeof createCommercialValidationTest>[0]),
          opportunityId: context.params.id,
        })
        record = { id: payload.id, opportunityId: context.params.id, kind: body.kind, payload, recordedAt }
        break
      }
      case "market_learning": {
        const payload = createMarketLearning({
          ...(body.payload as Parameters<typeof createMarketLearning>[0]),
          opportunityId: context.params.id,
        })
        record = { id: payload.id, opportunityId: context.params.id, kind: body.kind, payload, recordedAt }
        break
      }
      case "proof_sprint": {
        const payload = createProofSprint({
          ...(body.payload as Parameters<typeof createProofSprint>[0]),
          opportunityId: context.params.id,
        })
        record = { id: payload.id, opportunityId: context.params.id, kind: body.kind, payload, recordedAt }
        break
      }
      case "recurring_offer_assessment": {
        if (!body.recordId?.trim()) throw new Error("recordId is required for recurring offer assessments")
        const payload = assessRecurringOffer(body.payload as Parameters<typeof assessRecurringOffer>[0])
        record = {
          id: body.recordId.trim(),
          opportunityId: context.params.id,
          kind: body.kind,
          payload,
          recordedAt,
        }
        break
      }
      default:
        throw new Error("Unsupported commercial learning kind")
    }

    const persisted = await repository.upsertCommercialLearning(record)
    return NextResponse.json({ success: true, data: { record: persisted } }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist commercial learning"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

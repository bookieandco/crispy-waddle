import { NextResponse } from "next/server"
import { TRANSCRIPT_FOLD_EVENT_TYPES } from "@jhadina/event-bus"
import {
  assessRecurringOffer,
  createCommercialValidationTest,
  createMarketLearning,
  createOfferCanvas,
  createProofSprint,
  type CommercialValidationTest,
  type MarketLearning,
  type OfferCanvas,
  type ProofSprint,
  type RecurringOfferAssessment,
} from "@jhadina/opportunity-core"
import { createClient } from "@/lib/supabase/server"
import {
  createSupabaseOpportunityRepository,
  type CommercialLearningKind,
  type StoredCommercialLearningRecord,
} from "@/lib/opportunities/supabase-opportunity-repository"
import {
  parseTranscriptFoldRuntimeTrace,
  prepareTranscriptFoldEventEmitter,
} from "@/lib/runtime/transcript-fold-event-runtime"

export const dynamic = "force-dynamic"

type CommercialBody = {
  kind?: CommercialLearningKind
  recordId?: string
  recordedAt?: string
  payload?: Record<string, unknown>
  runtime?: unknown
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

    const runtime = parseTranscriptFoldRuntimeTrace(body.runtime)
    const emitter = await prepareTranscriptFoldEventEmitter({
      userId: user.id,
      runtime,
    })

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
    const event = await emitCommercialLearningEvent(emitter, persisted)
    return NextResponse.json({
      success: true,
      data: {
        record: persisted,
        event: { id: event.id, type: event.type },
      },
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist commercial learning"
    const status = /Authentication|IDENTITY|SESSION/i.test(message) ? 401 : /NOT_FOUND/.test(message) ? 404 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

async function emitCommercialLearningEvent(
  emitter: Awaited<ReturnType<typeof prepareTranscriptFoldEventEmitter>>,
  record: StoredCommercialLearningRecord,
) {
  switch (record.kind) {
    case "offer_canvas": {
      const payload = record.payload as OfferCanvas
      const evidenceRefs = [
        ...payload.customer.evidenceRefs,
        ...payload.problem.evidenceRefs,
        ...payload.desiredOutcome.evidenceRefs,
        ...payload.offer.evidenceRefs,
        ...payload.deliveryModel.evidenceRefs,
        ...payload.acquisitionChannel.evidenceRefs,
        ...(payload.retentionMechanism?.evidenceRefs ?? []),
        ...(payload.price?.evidenceRefs ?? []),
      ]
      return emitter.emit({
        type: TRANSCRIPT_FOLD_EVENT_TYPES.OFFER_CANVAS_PERSISTED,
        entityId: record.id,
        occurredAt: record.recordedAt,
        payload: {
          recordId: record.id,
          opportunityId: record.opportunityId,
          evidenceRefs: [...new Set(evidenceRefs)],
        },
      })
    }
    case "validation_test": {
      const payload = record.payload as CommercialValidationTest
      return emitter.emit({
        type: TRANSCRIPT_FOLD_EVENT_TYPES.VALIDATION_TEST_PERSISTED,
        entityId: record.id,
        occurredAt: record.recordedAt,
        payload: {
          recordId: record.id,
          opportunityId: record.opportunityId,
          expectedCommitment: payload.expectedCommitment,
          evidenceRefs: payload.evidenceRefs,
        },
      })
    }
    case "market_learning": {
      const payload = record.payload as MarketLearning
      return emitter.emit({
        type: TRANSCRIPT_FOLD_EVENT_TYPES.MARKET_LEARNING_OBSERVED,
        entityId: record.id,
        occurredAt: record.recordedAt,
        payload: {
          recordId: record.id,
          opportunityId: record.opportunityId,
          commitmentLevel: payload.commitmentLevel,
          evidenceRefs: payload.evidenceRefs,
        },
      })
    }
    case "proof_sprint": {
      const payload = record.payload as ProofSprint
      return emitter.emit({
        type: TRANSCRIPT_FOLD_EVENT_TYPES.PROOF_SPRINT_PERSISTED,
        entityId: record.id,
        occurredAt: record.recordedAt,
        payload: {
          recordId: record.id,
          opportunityId: record.opportunityId,
          validationTestIds: payload.validationTestIds,
        },
      })
    }
    case "recurring_offer_assessment": {
      const payload = record.payload as RecurringOfferAssessment
      return emitter.emit({
        type: TRANSCRIPT_FOLD_EVENT_TYPES.RECURRING_OFFER_ASSESSED,
        entityId: record.id,
        occurredAt: record.recordedAt,
        payload: {
          recordId: record.id,
          opportunityId: record.opportunityId,
          supported: payload.supported,
          evidenceRefs: payload.evidenceRefs,
        },
      })
    }
  }
}

import { NextRequest, NextResponse } from "next/server"
import { TRANSCRIPT_FOLD_EVENT_TYPES } from "@jhadina/event-bus"
import {
  createIdealCustomerProfile,
  createProspectRecord,
} from "@jhadina/opportunity-core"
import { createClient } from "@/lib/supabase/server"
import { createSupabaseOpportunityRepository } from "@/lib/opportunities/supabase-opportunity-repository"
import {
  parseTranscriptFoldRuntimeTrace,
  prepareTranscriptFoldEventEmitter,
} from "@/lib/runtime/transcript-fold-event-runtime"

export const dynamic = "force-dynamic"

type ProspectBody = {
  kind?: "icp" | "prospect"
  payload?: Record<string, unknown>
  runtime?: unknown
}

async function authenticated() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(req: NextRequest) {
  const user = await authenticated()
  if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })

  try {
    const repository = createSupabaseOpportunityRepository()
    const icpId = req.nextUrl.searchParams.get("icpId") ?? undefined
    const [icps, prospects] = await Promise.all([
      repository.listProspectIcps(),
      repository.listProspects(icpId),
    ])
    return NextResponse.json({ success: true, data: { icps, prospects } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load prospect intelligence"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  const user = await authenticated()
  if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })

  try {
    const body = await req.json() as ProspectBody
    if (!body.kind || !body.payload) {
      return NextResponse.json({ success: false, error: "kind and payload are required" }, { status: 400 })
    }

    const runtime = parseTranscriptFoldRuntimeTrace(body.runtime)
    const emitter = await prepareTranscriptFoldEventEmitter({
      userId: user.id,
      runtime,
    })
    const repository = createSupabaseOpportunityRepository()

    if (body.kind === "icp") {
      const icp = createIdealCustomerProfile(body.payload as Parameters<typeof createIdealCustomerProfile>[0])
      const persisted = await repository.upsertProspectIcp(icp)
      const event = await emitter.emit({
        type: TRANSCRIPT_FOLD_EVENT_TYPES.PROSPECT_ICP_PERSISTED,
        entityId: persisted.id,
        occurredAt: persisted.createdAt,
        payload: {
          icpId: persisted.id,
          evidenceRefs: persisted.evidenceRefs,
        },
      })
      return NextResponse.json({
        success: true,
        data: { icp: persisted, event: { id: event.id, type: event.type } },
      }, { status: 201 })
    }

    if (body.kind === "prospect") {
      const prospect = createProspectRecord(body.payload as Parameters<typeof createProspectRecord>[0])
      const persisted = await repository.upsertProspect(prospect)
      const event = await emitter.emit({
        type: TRANSCRIPT_FOLD_EVENT_TYPES.PROSPECT_RECORD_PERSISTED,
        entityId: persisted.id,
        occurredAt: persisted.lastVerifiedAt,
        payload: {
          prospectId: persisted.id,
          icpId: persisted.icpId,
          contactQuality: persisted.contactQuality,
          suppressionState: persisted.suppressionState,
          evidenceRefs: persisted.evidence.map((evidence) => evidence.id),
        },
      })
      return NextResponse.json({
        success: true,
        data: { prospect: persisted, event: { id: event.id, type: event.type } },
      }, { status: 201 })
    }

    return NextResponse.json({ success: false, error: "Unsupported prospect kind" }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist prospect intelligence"
    const status = /Authentication|IDENTITY|SESSION/i.test(message) ? 401 : /NOT_FOUND/.test(message) ? 404 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

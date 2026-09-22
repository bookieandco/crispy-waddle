import { NextResponse } from "next/server"
import { recordSideHustleExperimentObservation } from "@jhadina/opportunity-core"
import { createClient } from "@/lib/supabase/server"
import { createSupabaseOpportunityRepository } from "@/lib/opportunities/supabase-opportunity-repository"

export const dynamic = "force-dynamic"

type ObservationBody = {
  metrics?: Record<string, number>
  spend?: number
  hours?: number
  evidenceRefs?: string[]
  notes?: string
}

export async function POST(
  req: Request,
  context: { params: { id: string; experimentId: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })

  try {
    const body = await req.json() as ObservationBody
    const repository = createSupabaseOpportunityRepository()
    const experiments = await repository.listSideHustleExperiments(context.params.id)
    const stored = experiments.find((item) => item.experiment.id === context.params.experimentId)
    if (!stored) return NextResponse.json({ success: false, error: "Experiment not found" }, { status: 404 })

    const observation = recordSideHustleExperimentObservation({
      experiment: stored.experiment,
      observation: {
        id: `side-hustle-observation:${crypto.randomUUID()}`,
        experimentId: stored.experiment.id,
        observedAt: new Date().toISOString(),
        metrics: body.metrics ?? {},
        spend: body.spend ?? Number.NaN,
        hours: body.hours ?? Number.NaN,
        evidenceRefs: body.evidenceRefs ?? [],
        notes: body.notes?.trim() || undefined,
      },
    })

    const persisted = await repository.recordSideHustleExperimentObservation(observation)
    return NextResponse.json({ success: true, data: { observation: persisted } }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record side hustle observation"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

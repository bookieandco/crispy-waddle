import { NextResponse } from "next/server"
import { startSideHustleExperiment as startExperiment } from "@jhadina/opportunity-core"
import { createClient } from "@/lib/supabase/server"
import { createSupabaseOpportunityRepository } from "@/lib/opportunities/supabase-opportunity-repository"

export const dynamic = "force-dynamic"

export async function POST(
  _req: Request,
  context: { params: { id: string; experimentId: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })

  try {
    const repository = createSupabaseOpportunityRepository()
    const experiments = await repository.listSideHustleExperiments(context.params.id)
    const stored = experiments.find((item) => item.experiment.id === context.params.experimentId)
    if (!stored) return NextResponse.json({ success: false, error: "Experiment not found" }, { status: 404 })

    const startedAt = new Date().toISOString()
    const transitioned = startExperiment(stored.experiment, startedAt)
    const persisted = await repository.startSideHustleExperiment(transitioned.id, startedAt)

    return NextResponse.json({ success: true, data: { experiment: persisted } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start side hustle experiment"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

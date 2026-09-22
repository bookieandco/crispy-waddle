import { NextResponse } from "next/server"
import { completeSideHustleExperiment as completeExperiment } from "@jhadina/opportunity-core"
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
    const before = await repository.listSideHustleExperiments(context.params.id)
    const stored = before.find((item) => item.experiment.id === context.params.experimentId)
    if (!stored) return NextResponse.json({ success: false, error: "Experiment not found" }, { status: 404 })

    const completedAt = new Date().toISOString()
    const transitioned = completeExperiment(stored.experiment, completedAt)
    await repository.completeSideHustleExperiment(transitioned.id, completedAt)

    const after = await repository.listSideHustleExperiments(context.params.id)
    const completed = after.find((item) => item.experiment.id === context.params.experimentId)
    if (!completed) throw new Error("Completed experiment could not be reloaded")

    return NextResponse.json({ success: true, data: completed })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete side hustle experiment"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

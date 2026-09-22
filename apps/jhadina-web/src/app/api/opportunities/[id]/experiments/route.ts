import { NextResponse } from "next/server"
import {
  createSideHustleExperiment,
  type SideHustleExperimentCriterion,
} from "@jhadina/opportunity-core"
import { createClient } from "@/lib/supabase/server"
import { createSupabaseOpportunityRepository } from "@/lib/opportunities/supabase-opportunity-repository"

export const dynamic = "force-dynamic"

type CreateExperimentBody = {
  hypothesis?: string
  targetCustomer?: string
  channel?: string
  offer?: string
  maxSpend?: number
  currency?: string
  maxHours?: number
  maxDurationDays?: number
  minimumObservations?: number
  successCriteria?: SideHustleExperimentCriterion[]
  killCriteria?: SideHustleExperimentCriterion[]
  evidenceRefs?: string[]
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

    const experiments = await repository.listSideHustleExperiments(context.params.id)
    return NextResponse.json({ success: true, data: { experiments } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load side hustle experiments"
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
    const body = await req.json() as CreateExperimentBody
    const repository = createSupabaseOpportunityRepository()
    const stored = await repository.get(context.params.id)
    if (!stored) return NextResponse.json({ success: false, error: "Opportunity not found" }, { status: 404 })

    const createdAt = new Date().toISOString()
    const experiment = createSideHustleExperiment({
      opportunity: stored.opportunity,
      hypothesis: body.hypothesis ?? "",
      targetCustomer: body.targetCustomer ?? "",
      channel: body.channel ?? "",
      offer: body.offer ?? "",
      maxSpend: body.maxSpend ?? Number.NaN,
      currency: body.currency ?? "",
      maxHours: body.maxHours ?? Number.NaN,
      maxDurationDays: body.maxDurationDays ?? Number.NaN,
      minimumObservations: body.minimumObservations ?? Number.NaN,
      successCriteria: body.successCriteria ?? [],
      killCriteria: body.killCriteria ?? [],
      evidenceRefs: body.evidenceRefs ?? [],
      createdAt,
    })

    const persisted = await repository.createSideHustleExperiment(experiment)
    return NextResponse.json({ success: true, data: { experiment: persisted } }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create side hustle experiment"
    const status = message.toLowerCase().includes("active") ? 409 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

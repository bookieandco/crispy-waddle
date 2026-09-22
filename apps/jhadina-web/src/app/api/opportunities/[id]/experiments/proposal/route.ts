import { NextResponse } from "next/server"
import { proposeSideHustleExperiment } from "@jhadina/opportunity-core"
import { createClient } from "@/lib/supabase/server"
import { createSupabaseOpportunityRepository } from "@/lib/opportunities/supabase-opportunity-repository"

export const dynamic = "force-dynamic"

type ProposalBody = {
  targetCustomer?: string
  offer?: string
  currency?: string
  maxSpend?: number
  maxHours?: number
  maxDurationDays?: number
  evidenceRefs?: string[]
}

export async function POST(
  req: Request,
  context: { params: { id: string } },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({})) as ProposalBody
    const repository = createSupabaseOpportunityRepository()
    const stored = await repository.get(context.params.id)
    if (!stored) return NextResponse.json({ success: false, error: "Opportunity not found" }, { status: 404 })

    const proposal = proposeSideHustleExperiment({
      opportunity: stored.opportunity,
      evidenceRefs: body.evidenceRefs,
      targetCustomer: body.targetCustomer,
      offer: body.offer,
      currency: body.currency,
      maxSpend: body.maxSpend,
      maxHours: body.maxHours,
      maxDurationDays: body.maxDurationDays,
      generatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, data: { proposal } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to propose side hustle experiment"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

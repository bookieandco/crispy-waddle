import { NextResponse } from "next/server"
import {
  applyOpportunityOutcome,
  buildOpportunityLearningSignal,
  calculateOpportunityOutcome,
  type OpportunityOutcomeObservationInput,
} from "@jhadina/opportunity-core"
import { createClient } from "@/lib/supabase/server"
import { toOpportunityView } from "@/lib/opportunities/canonical"
import { createSupabaseOpportunityRepository } from "@/lib/opportunities/supabase-opportunity-repository"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })

  const input = await req.json() as Partial<OpportunityOutcomeObservationInput>
  if (!input.opportunityId?.trim()) {
    return NextResponse.json({ success: false, error: "opportunityId is required" }, { status: 400 })
  }

  const repository = createSupabaseOpportunityRepository()
  const stored = await repository.get(input.opportunityId)
  if (!stored) return NextResponse.json({ success: false, error: "Opportunity not found" }, { status: 404 })

  try {
    const outcome = calculateOpportunityOutcome(input as OpportunityOutcomeObservationInput)
    const learningSignal = buildOpportunityLearningSignal(stored.opportunity, outcome)
    const closed = applyOpportunityOutcome(stored.opportunity, outcome)
    const persisted = await repository.recordOutcome(closed, outcome, learningSignal)

    return NextResponse.json({
      success: true,
      data: {
        opportunity: toOpportunityView(persisted.stored),
        outcome: persisted.outcome,
        learningSignal: persisted.learningSignal,
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to record opportunity outcome",
    }, { status: 400 })
  }
}

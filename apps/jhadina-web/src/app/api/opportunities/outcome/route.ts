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
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { VentureRuntimeRepository } from "@/lib/opportunities/venture-runtime-repository"
import { runSideHustleLabOutcomeLearningRuntime } from "@/lib/opportunities/side-hustle-lab-runtime"

type UserOutcomeInput = Omit<OpportunityOutcomeObservationInput, "sourceOwner"> & {
  sourceOwner?: never
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })

  const input = await req.json() as Partial<UserOutcomeInput>
  if (!input.opportunityId?.trim()) {
    return NextResponse.json({ success: false, error: "opportunityId is required" }, { status: 400 })
  }

  const repository = createSupabaseOpportunityRepository()
  const stored = await repository.get(input.opportunityId)
  if (!stored) return NextResponse.json({ success: false, error: "Opportunity not found" }, { status: 404 })

  try {
    // This public authenticated route records user-reported actuals only.
    // Trusted subsystem labels (money_core, commerce, placement, overageos)
    // must be produced by their server-side bridges, never claimed by a
    // client request. Growth consumes learning signals; it is not a source
    // of financial truth.
    const outcome = calculateOpportunityOutcome({
      ...(input as Omit<OpportunityOutcomeObservationInput, "sourceOwner">),
      sourceOwner: "user",
    })
    const learningSignal = buildOpportunityLearningSignal(stored.opportunity, outcome)
    const closed = applyOpportunityOutcome(stored.opportunity, outcome)
    const persisted = await repository.recordOutcome(closed, outcome, learningSignal)

    let sideHustleLab: unknown = { status: "not_applicable" }
    const service = createServiceRoleClient()
    if (service) {
      const ventureRepository = new VentureRuntimeRepository(service)
      const venture = await ventureRepository.getVentureByOpportunity(user.id, persisted.outcome.opportunityId)
      if (venture) {
        try {
          sideHustleLab = {
            status: "recorded",
            result: await runSideHustleLabOutcomeLearningRuntime({
              ownerUserId: user.id,
              ventureId: venture.id,
              outcomeId: persisted.outcome.id,
              assessedAt: new Date().toISOString(),
            }, {
              opportunities: repository,
              ventures: ventureRepository,
            }),
          }
        } catch (bridgeError) {
          // Canonical outcome truth is already durable. A Side Hustle Lab
          // bridge failure is repairable and must not roll back or rewrite it.
          sideHustleLab = {
            status: "deferred",
            error: bridgeError instanceof Error ? bridgeError.message : "side_hustle_lab_outcome_bridge_failed",
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        opportunity: toOpportunityView(persisted.stored),
        outcome: persisted.outcome,
        learningSignal: persisted.learningSignal,
        sideHustleLab,
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unable to record opportunity outcome",
    }, { status: 400 })
  }
}

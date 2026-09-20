import { NextResponse } from "next/server"
import { approveOpportunityForResearch } from "@jhadina/opportunity-core"
import { createClient } from "@/lib/supabase/server"
import { toOpportunityView } from "@/lib/opportunities/canonical"
import { createSupabaseOpportunityRepository } from "@/lib/opportunities/supabase-opportunity-repository"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })

  const { opportunityId } = await req.json() as { opportunityId?: string }
  if (!opportunityId?.trim()) {
    return NextResponse.json({ success: false, error: "opportunityId is required" }, { status: 400 })
  }

  const repository = createSupabaseOpportunityRepository()
  const stored = await repository.get(opportunityId)
  if (!stored || !["discovered", "research_pending"].includes(stored.opportunity.status)) {
    return NextResponse.json({ success: false, error: "Opportunity not found or already decided" }, { status: 404 })
  }

  const plan = approveOpportunityForResearch(stored.opportunity)
  const updated = await repository.startResearch(plan.opportunity, plan.pursuitCase)

  return NextResponse.json({
    success: true,
    data: {
      opportunity: toOpportunityView(updated),
      researchCase: plan.pursuitCase,
    },
  })
}

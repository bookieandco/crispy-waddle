import { NextResponse } from "next/server"
import { markOpportunityReady, type PursuitTaskStatus } from "@jhadina/opportunity-core"
import { createClient } from "@/lib/supabase/server"
import { toOpportunityView } from "@/lib/opportunities/canonical"
import { createSupabaseOpportunityRepository } from "@/lib/opportunities/supabase-opportunity-repository"

const TASK_STATUSES = new Set<PursuitTaskStatus>(["pending","in_progress","completed","blocked"])

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })

  const body = await req.json() as {
    opportunityId?: string
    researchCaseId?: string
    taskId?: string
    status?: PursuitTaskStatus
    evidenceRefs?: string[]
  }

  if (!body.opportunityId?.trim() || !body.researchCaseId?.trim() || !body.taskId?.trim()) {
    return NextResponse.json({ success: false, error: "opportunityId, researchCaseId, and taskId are required" }, { status: 400 })
  }
  if (!body.status || !TASK_STATUSES.has(body.status)) {
    return NextResponse.json({ success: false, error: "research task status is invalid" }, { status: 400 })
  }
  if (body.status === "completed" && (!body.evidenceRefs || body.evidenceRefs.length === 0)) {
    return NextResponse.json({ success: false, error: "completed research tasks require evidenceRefs" }, { status: 400 })
  }

  const repository = createSupabaseOpportunityRepository()
  const stored = await repository.get(body.opportunityId)
  if (!stored || stored.researchCaseId !== body.researchCaseId) {
    return NextResponse.json({ success: false, error: "Opportunity research case not found" }, { status: 404 })
  }

  const pursuitCase = await repository.updateResearchTask({
    researchCaseId: body.researchCaseId,
    taskId: body.taskId,
    status: body.status,
    evidenceRefs: body.evidenceRefs,
  })

  let updated = stored
  if (pursuitCase.status === "ready" && stored.opportunity.family !== "recovery") {
    const ready = markOpportunityReady(stored.opportunity, pursuitCase)
    updated = await repository.promoteReady(ready, pursuitCase.id)
  }

  return NextResponse.json({
    success: true,
    data: {
      opportunity: toOpportunityView(updated),
      researchCase: pursuitCase,
    },
  })
}

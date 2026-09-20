import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { toOpportunityView } from "@/lib/opportunities/canonical"
import { createSupabaseOpportunityRepository } from "@/lib/opportunities/supabase-opportunity-repository"
import type { OpportunityTriageState } from "@/lib/opportunities/sideIncome"

export const dynamic = "force-dynamic"

const TRIAGE = new Set<OpportunityTriageState>(["review","saved","dismissed"])

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })

  const body = await req.json() as { opportunityId?: string; triageState?: OpportunityTriageState }
  if (!body.opportunityId?.trim()) return NextResponse.json({ success: false, error: "opportunityId is required" }, { status: 400 })
  if (!body.triageState || !TRIAGE.has(body.triageState)) return NextResponse.json({ success: false, error: "triageState is invalid" }, { status: 400 })

  const updated = await createSupabaseOpportunityRepository().setTriage(body.opportunityId, body.triageState)
  if (!updated) return NextResponse.json({ success: false, error: "Opportunity not found" }, { status: 404 })
  return NextResponse.json({ success: true, data: { opportunity: toOpportunityView(updated) } })
}

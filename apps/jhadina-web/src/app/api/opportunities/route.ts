import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { canonicalFromSideIncome, toOpportunityView, type OpportunityCreateInput } from "@/lib/opportunities/canonical"
import { createSupabaseOpportunityRepository } from "@/lib/opportunities/supabase-opportunity-repository"
import type { AutomationLevel, OpportunityKind } from "@/lib/opportunities/sideIncome"
import { rankSideIncomeOpportunities } from "@/lib/opportunities/sideIncome"

export const dynamic = "force-dynamic"

const KINDS = new Set<OpportunityKind>(["pod","dropshipping","ai_job","remote_gig","freelance","creator","affiliate","automation","overage"])
const AUTOMATION = new Set<AutomationLevel>(["ai_can_do_it","ai_plus_user","user_led","do_not_pursue"])

async function authenticatedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await authenticatedUser()
  if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })

  const repository = createSupabaseOpportunityRepository()
  const stored = await repository.list()
  const ranked = rankSideIncomeOpportunities(stored.map(toOpportunityView))
  return NextResponse.json({ success: true, data: { opportunities: ranked } })
}

export async function POST(req: Request) {
  const user = await authenticatedUser()
  if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })

  const body = await req.json() as Partial<OpportunityCreateInput>
  const validationError = validateCreateInput(body)
  if (validationError) return NextResponse.json({ success: false, error: validationError }, { status: 400 })

  const input = body as OpportunityCreateInput
  const id = `opportunity:${crypto.randomUUID()}`
  const opportunity = canonicalFromSideIncome(input, id)
  const stored = await createSupabaseOpportunityRepository().upsert(user.id, opportunity)
  return NextResponse.json({ success: true, data: { opportunity: toOpportunityView(stored) } }, { status: 201 })
}

function validateCreateInput(body: Partial<OpportunityCreateInput>): string | undefined {
  if (!body.title?.trim()) return "title is required"
  if (!body.sourceUrl?.trim()) return "sourceUrl is required"
  if (!body.sourceName?.trim()) return "sourceName is required"
  if (!body.summary?.trim()) return "summary is required"
  if (!body.kind || !KINDS.has(body.kind)) return "kind is invalid"
  if (!body.automationLevel || !AUTOMATION.has(body.automationLevel)) return "automationLevel is invalid"
  if (typeof body.fitScore !== "number" || !Number.isFinite(body.fitScore) || body.fitScore < 0 || body.fitScore > 100) return "fitScore must be between 0 and 100"
  return undefined
}

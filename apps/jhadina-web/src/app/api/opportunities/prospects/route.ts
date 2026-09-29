import { NextRequest, NextResponse } from "next/server"
import {
  createIdealCustomerProfile,
  createProspectRecord,
} from "@jhadina/opportunity-core"
import { createClient } from "@/lib/supabase/server"
import { createSupabaseOpportunityRepository } from "@/lib/opportunities/supabase-opportunity-repository"

export const dynamic = "force-dynamic"

type ProspectBody = {
  kind?: "icp" | "prospect"
  payload?: Record<string, unknown>
}

async function authenticated() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(req: NextRequest) {
  const user = await authenticated()
  if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })

  try {
    const repository = createSupabaseOpportunityRepository()
    const icpId = req.nextUrl.searchParams.get("icpId") ?? undefined
    const [icps, prospects] = await Promise.all([
      repository.listProspectIcps(),
      repository.listProspects(icpId),
    ])
    return NextResponse.json({ success: true, data: { icps, prospects } })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load prospect intelligence"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  const user = await authenticated()
  if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })

  try {
    const body = await req.json() as ProspectBody
    if (!body.kind || !body.payload) {
      return NextResponse.json({ success: false, error: "kind and payload are required" }, { status: 400 })
    }

    const repository = createSupabaseOpportunityRepository()
    if (body.kind === "icp") {
      const icp = createIdealCustomerProfile(body.payload as Parameters<typeof createIdealCustomerProfile>[0])
      const persisted = await repository.upsertProspectIcp(icp)
      return NextResponse.json({ success: true, data: { icp: persisted } }, { status: 201 })
    }

    if (body.kind === "prospect") {
      const prospect = createProspectRecord(body.payload as Parameters<typeof createProspectRecord>[0])
      const persisted = await repository.upsertProspect(prospect)
      return NextResponse.json({ success: true, data: { prospect: persisted } }, { status: 201 })
    }

    return NextResponse.json({ success: false, error: "Unsupported prospect kind" }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist prospect intelligence"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

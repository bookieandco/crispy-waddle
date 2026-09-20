import { NextRequest, NextResponse } from "next/server"
import { adaptRemoteOkAiJob } from "@jhadina/opportunity-core"
import { createClient } from "@/lib/supabase/server"
import { toOpportunityView } from "@/lib/opportunities/canonical"
import { createSupabaseOpportunityRepository } from "@/lib/opportunities/supabase-opportunity-repository"
import { discoverRemoteOkAiJobs } from "@/lib/opportunities/remoteok-client"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 })

    const limit = parseLimit(request.nextUrl.searchParams.get("limit"))
    const tag = request.nextUrl.searchParams.get("tag") ?? undefined
    const discovered = await discoverRemoteOkAiJobs({ limit, tag })
    const repository = createSupabaseOpportunityRepository()

    const stored = []
    for (const job of discovered.jobs) {
      const opportunity = adaptRemoteOkAiJob(job, discovered.fetchedAt)
      stored.push(await repository.upsert(user.id, opportunity))
    }

    return NextResponse.json({
      success: true,
      data: {
        source: "Remote OK",
        attribution: {
          required: true,
          label: "Remote OK",
          linkBackPreservedOnEveryOpportunity: true,
        },
        count: stored.length,
        opportunities: stored.map(toOpportunityView),
        execution: {
          owner: "Placement Core",
          autoApply: false,
          requiresResearchAndUserApproval: true,
        },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Remote OK discovery failed"
    const status = /limit|tag is invalid/.test(message) ? 400 : 502
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

function parseLimit(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new Error("Remote OK limit must be an integer between 1 and 100")
  }
  return parsed
}

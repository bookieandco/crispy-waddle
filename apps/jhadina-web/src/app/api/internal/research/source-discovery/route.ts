import { NextRequest, NextResponse } from "next/server"
import {
  searchRecoverySources,
  type RecoveryAuthorityRole,
} from "@/lib/research/source-discovery-provider"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const ROLES = new Set<RecoveryAuthorityRole>([
  "COUNTY_JAIL_OR_SHERIFF",
  "STATE_DEPARTMENT_OF_CORRECTIONS",
  "COUNTY_CONTROLLER_OR_AUDITOR",
  "COUNTY_TREASURER",
  "STATE_TREASURER_OR_UNCLAIMED_PROPERTY",
])

function authorized(request: NextRequest): boolean {
  const secret = process.env.JHADINA_INTERNAL_RESEARCH_SECRET || process.env.CRON_SECRET
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`)
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const query = typeof body.query === "string" ? body.query.trim() : ""
    const authorityRole = body.authorityRole as RecoveryAuthorityRole

    if (!query || query.length > 500) {
      return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
    }
    if (!ROLES.has(authorityRole)) {
      return NextResponse.json({ ok: false, error: "invalid_authority_role" }, { status: 400 })
    }

    const candidates = await searchRecoverySources({
      query,
      authorityRole,
      stateCode: typeof body.stateCode === "string" ? body.stateCode : undefined,
      countyName: typeof body.countyName === "string" ? body.countyName : undefined,
      desiredSourceTypes: Array.isArray(body.desiredSourceTypes) ? body.desiredSourceTypes : undefined,
      maxResults: Number.isInteger(body.maxResults) ? body.maxResults : 8,
    })

    return NextResponse.json({
      ok: true,
      schema: "jhadina.research.recovery-source-discovery.v1",
      authority: "DISCOVERY_ONLY",
      query,
      authorityRole,
      candidates,
      invariants: {
        searchResultDoesNotVerifyClaimant: true,
        searchResultDoesNotVerifyEntitlement: true,
        accessReviewSeparate: true,
        noExternalActionAuthority: true,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "source_discovery_failed"
    const status = message === "JHADINA_WEB_SEARCH_NOT_CONFIGURED" ? 503 : 502
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}

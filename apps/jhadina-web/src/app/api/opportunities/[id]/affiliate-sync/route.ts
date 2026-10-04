import { NextResponse } from "next/server"
import { requireRequestIdentity } from "@/lib/auth/request-user"
import {
  createAffiliateNetworkProvider,
  type AffiliateNetworkProviderName,
} from "@/lib/opportunities/affiliate-network-providers"
import { syncAffiliateNetworkObservations } from "@/lib/opportunities/affiliate-network-sync"
import { createSupabaseOpportunityRepository } from "@/lib/opportunities/supabase-opportunity-repository"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Body = {
  provider?: AffiliateNetworkProviderName
  startAt?: string
  endAt?: string
  cursor?: string
  limit?: number
  maxPages?: number
}

function fail(requestId: string, message: string, status = 400) {
  return NextResponse.json(
    { ok: false, requestId, error: message },
    { status, headers: { "cache-control": "no-store" } },
  )
}

function statusFor(message: string) {
  if (/Authenticated|identity|session/i.test(message)) return 401
  if (/NOT_FOUND/.test(message)) return 404
  if (/REQUIRES_COMMERCE_AFFILIATE|MISMATCH/.test(message)) return 409
  if (/_NOT_CONFIGURED/.test(message)) return 503
  return 400
}

export async function POST(
  request: Request,
  context: { params: { id: string } },
) {
  const requestId = crypto.randomUUID()
  try {
    await requireRequestIdentity()
    const body = (await request.json().catch(() => ({}))) as Body
    if (body.provider !== "partnerize" && body.provider !== "cj-affiliate") {
      return fail(
        requestId,
        "Affiliate network provider must be partnerize or cj-affiliate",
      )
    }

    const binding = createAffiliateNetworkProvider(body.provider)
    const repository = createSupabaseOpportunityRepository()
    const result = await syncAffiliateNetworkObservations(
      {
        opportunityId: context.params.id,
        accountRef: binding.accountRef,
        startAt: body.startAt,
        endAt: body.endAt,
        cursor: body.cursor,
        limit: body.limit,
        maxPages: body.maxPages,
      },
      binding.adapter,
      repository,
    )

    return NextResponse.json(
      { ok: true, requestId, result },
      { headers: { "cache-control": "no-store" } },
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to sync affiliate network"
    return fail(requestId, message, statusFor(message))
  }
}

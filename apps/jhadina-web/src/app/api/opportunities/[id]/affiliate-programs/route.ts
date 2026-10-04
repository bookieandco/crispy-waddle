import { NextResponse } from "next/server"
import type { AffiliateCommissionType } from "@jhadina/commerce-adapters"
import { requireRequestIdentity } from "@/lib/auth/request-user"
import { createSupabaseOpportunityRepository } from "@/lib/opportunities/supabase-opportunity-repository"
import { researchOpenAffiliateProgramsForOpportunity } from "@/lib/opportunities/openaffiliate-program-research"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const COMMISSION_TYPES = new Set<AffiliateCommissionType>([
  "recurring",
  "one-time",
  "tiered",
  "hybrid",
])

function fail(requestId: string, message: string, status = 400) {
  return NextResponse.json(
    { ok: false, requestId, error: message },
    { status, headers: { "cache-control": "no-store" } },
  )
}

function statusFor(message: string): number {
  if (/Authenticated|identity|session/i.test(message)) return 401
  if (/NOT_FOUND/.test(message)) return 404
  if (/REQUIRES_COMMERCE_AFFILIATE/.test(message)) return 409
  return 400
}

export async function GET(request: Request, context: { params: { id: string } }) {
  const requestId = crypto.randomUUID()
  try {
    await requireRequestIdentity()
    const url = new URL(request.url)
    const type = url.searchParams.get("type")?.trim()
    if (type && !COMMISSION_TYPES.has(type as AffiliateCommissionType)) {
      return fail(requestId, "Invalid affiliate commission type")
    }

    const rawLimit = url.searchParams.get("limit")
    const parsedLimit = rawLimit === null ? undefined : Number(rawLimit)
    if (
      parsedLimit !== undefined &&
      (!Number.isInteger(parsedLimit) || parsedLimit < 1)
    ) {
      return fail(requestId, "Affiliate program limit must be a positive integer")
    }

    const verifiedParam = url.searchParams.get("verified")
    if (
      verifiedParam !== null &&
      verifiedParam !== "true" &&
      verifiedParam !== "false"
    ) {
      return fail(requestId, "Affiliate verified filter must be true or false")
    }

    const repository = createSupabaseOpportunityRepository()
    const result = await researchOpenAffiliateProgramsForOpportunity(
      {
        opportunityId: context.params.id,
        query: url.searchParams.get("q") ?? undefined,
        category: url.searchParams.get("category") ?? undefined,
        commissionType: type as AffiliateCommissionType | undefined,
        verifiedOnly:
          verifiedParam === null ? undefined : verifiedParam === "true",
        limit: parsedLimit,
      },
      repository,
    )

    return NextResponse.json(
      { ok: true, requestId, result },
      { headers: { "cache-control": "no-store" } },
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to research affiliate programs"
    return fail(requestId, message, statusFor(message))
  }
}

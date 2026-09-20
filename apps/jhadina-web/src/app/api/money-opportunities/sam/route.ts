import { NextRequest, NextResponse } from 'next/server'
import { createRequestIdentityVerifier } from '@/lib/auth/request-identity'
import { canonicalizeSamResults } from '@/lib/money-opportunities/canonical-sam-workflow'
import { searchSamOpportunities } from '@/lib/money-opportunities/sam-client'
import { parseSamRouteSearch } from '@/lib/money-opportunities/sam-route-input'
import { toOpportunityView } from '@/lib/opportunities/canonical'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  try {
    const identityVerifier = await createRequestIdentityVerifier()
    const identity = await identityVerifier.verify({})
    const params = parseSamRouteSearch(request.nextUrl.searchParams)
    const data = await searchSamOpportunities(params)
    const opportunities = canonicalizeSamResults(data)
    const repository = createSupabaseOpportunityRepository()
    const stored = await Promise.all(
      opportunities.map((opportunity) => repository.upsert(identity.userId, opportunity)),
    )

    return NextResponse.json({
      ok: true,
      requestId,
      source: 'sam.gov',
      count: stored.length,
      opportunities: stored.map(toOpportunityView),
    }, {
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SAM.gov error'
    const configurationError = message.includes('not configured')
    const validationError = /Invalid|Unsupported|too long|must use/.test(message)
    const identityError = /Authenticated|identity|session/i.test(message)
    const status = identityError ? 401 : configurationError ? 503 : validationError ? 400 : 502
    const publicError = identityError
      ? 'Authentication required'
      : validationError
        ? message
        : configurationError
          ? message
          : 'SAM.gov request failed'

    return NextResponse.json(
      { ok: false, requestId, error: publicError },
      { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { searchSamOpportunities } from '@/lib/money-opportunities/sam-client'
import { canonicalizeSamResults } from '@/lib/money-opportunities/canonical-sam-workflow'
import { parseSamRouteSearch } from '@/lib/money-opportunities/sam-route-input'
import { createRequestIdentityVerifier } from '@/lib/auth/request-identity'
import { persistCanonicalSamOpportunities } from '@/lib/money-opportunities/sam-ingestion-persistence'
import { auditSamProductionIngestion } from '@/lib/money-opportunities/sam-production-audit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  try {
    const identityVerifier = await createRequestIdentityVerifier()
    const identity = await identityVerifier.verify({})
    const params = parseSamRouteSearch(request.nextUrl.searchParams)
    const data = await searchSamOpportunities(params)
    const opportunities = canonicalizeSamResults(data)
    const audit = auditSamProductionIngestion(opportunities)
    if (audit.status === 'blocked') throw new Error(`SAM production ingestion blocked: ${audit.blockers.join('; ')}`)
    const activeOpportunities = opportunities.filter((opportunity) => !audit.expiredIds.includes(opportunity.id))
    const persisted = await persistCanonicalSamOpportunities(activeOpportunities)
    if (persisted.userId !== identity.userId) throw new Error('Authenticated SAM ingestion identity mismatch')
    return NextResponse.json({
      ok: true,
      requestId,
      source: 'sam.gov',
      count: opportunities.length,
      persistedCount: persisted.persistedIds.length,
      expiredCount: audit.expiredIds.length,
      opportunities,
      governance: { verifiedUserId: identity.userId },
    }, {
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SAM.gov error'
    const configurationError = message.includes('not configured')
    const validationError = /Invalid|Unsupported|too long|must use/.test(message)
    const identityError = /Authenticated|identity|session/i.test(message)
    const status = identityError ? 401 : configurationError ? 503 : validationError ? 400 : 502
    return NextResponse.json(
      { ok: false, requestId, error: identityError ? 'Authentication required' : validationError ? message : configurationError ? message : 'SAM.gov request failed' },
      { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
    )
  }
}

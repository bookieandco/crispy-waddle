import { NextRequest, NextResponse } from 'next/server'
import { adaptSamOpportunity as adaptCanonicalSamOpportunity } from '@jhadina/opportunity-core'
import { createClient } from '@/lib/supabase/server'
import { searchSamOpportunities } from '@/lib/money-opportunities/sam-client'
import { normalizeSamOpportunityResults } from '@/lib/money-opportunities/sam-opportunity-adapter'
import { scoreSamOpportunity } from '@/lib/money-opportunities/sam-intelligence'
import { buildPartnerDiscoveryPlan } from '@/lib/money-opportunities/partner-discovery'
import { estimateOpportunityEconomics } from '@/lib/money-opportunities/economics'
import { buildMoneyAction } from '@/lib/money-opportunities/action-queue'
import { toOpportunityView } from '@/lib/opportunities/canonical'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 })

    const search = request.nextUrl.searchParams
    const data = await searchSamOpportunities({
      limit: Number(search.get('limit') ?? 25),
      offset: Number(search.get('offset') ?? 0),
      postedFrom: search.get('postedFrom') ?? undefined,
      postedTo: search.get('postedTo') ?? undefined,
      keyword: search.get('keyword') ?? undefined,
      noticeType: search.get('noticeType') ?? undefined,
      typeOfSetAside: search.get('typeOfSetAside') ?? undefined,
    })

    const repository = createSupabaseOpportunityRepository()
    const normalized = normalizeSamOpportunityResults(data)

    const intelligence = normalized
      .map((sam) => {
        const score = scoreSamOpportunity(sam)
        const partnerPlan = buildPartnerDiscoveryPlan(sam, score)
        const economics = estimateOpportunityEconomics(sam)
        const capabilityGap = partnerPlan.disposition === 'PARTNER_REQUIRED'
        const moneyAction = buildMoneyAction(sam, score, economics, { capabilityGap })

        const canonical = adaptCanonicalSamOpportunity({
          noticeId: sam.noticeId,
          title: sam.title,
          noticeType: sam.noticeType,
          department: sam.agency,
          office: sam.office,
          naicsCode: sam.naics,
          setAside: sam.setAside,
          responseDeadline: sam.responseDeadline,
          estimatedValue: sam.estimatedValue,
          placeOfPerformance: sam.placeOfPerformance,
          description: sam.description,
          sourceUrl: sam.sourceUrl ?? `https://sam.gov/opp/${sam.noticeId}/view`,
        })

        return {
          sam,
          score,
          partnerPlan,
          economics,
          moneyAction,
          canonical: {
            ...canonical,
            fitScore: score.total,
            opportunityScore: score.total,
            expectedValue: economics.estimatedGrossProfit,
            riskFlags: [
              ...canonical.riskFlags,
              ...(capabilityGap ? ['capability_gap_partner_required'] : []),
            ],
            metadata: {
              ...canonical.metadata,
              providerId: 'provider:sam.gov',
              capabilityGap,
              samScore: score,
              partnerPlan,
              moneyAction,
              economics,
            },
          },
        }
      })
      .sort((a, b) => b.score.total - a.score.total)

    const stored = await Promise.all(
      intelligence.map((item) => repository.upsert(user.id, item.canonical)),
    )

    return NextResponse.json({
      ok: true,
      source: 'sam.gov',
      count: stored.length,
      opportunities: stored.map(toOpportunityView),
      intelligence: intelligence.map(({ sam, score, partnerPlan, economics, moneyAction }) => ({
        noticeId: sam.noticeId,
        score,
        partnerPlan,
        economics,
        moneyAction,
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SAM.gov error'
    const status = message.includes('not configured') ? 503 : 502
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}

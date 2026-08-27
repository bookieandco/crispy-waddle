import { NextRequest, NextResponse } from 'next/server'
import { decideSamOpportunity } from '@/lib/money-opportunities/sam-decision'
import type { SamOpportunity } from '@/lib/money-opportunities/sam-types'
import type { SamPartnerProfile } from '@/lib/money-opportunities/sam-partner'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const defaultProfile: SamPartnerProfile = {
  capabilities: ['software', 'staffing', 'training', 'data', 'research', 'automation', 'ai', 'consulting'],
  preferredNaics: ['541511', '541512', '541519', '541611', '541618', '541990', '561311', '561320', '611430'],
  maxDirectContractValue: 500_000,
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { opportunity?: SamOpportunity; profile?: SamPartnerProfile }
    if (!body.opportunity?.noticeId || !body.opportunity.title) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_OPPORTUNITY', message: 'opportunity.noticeId and opportunity.title are required.' } },
        { status: 400 },
      )
    }

    const decision = decideSamOpportunity(body.opportunity, body.profile ?? defaultProfile)
    return NextResponse.json({ success: true, data: decision })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to evaluate SAM opportunity.'
    return NextResponse.json(
      { success: false, error: { code: 'SAM_DECISION_ERROR', message } },
      { status: 400 },
    )
  }
}

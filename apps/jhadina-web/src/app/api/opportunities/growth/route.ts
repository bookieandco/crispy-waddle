import { NextResponse } from 'next/server'
import type { GrowthSideHustleFactoryInput } from '@jhadina/growth-core'
import { createClient } from '@/lib/supabase/server'
import { ingestGrowthSideHustleOpportunity } from '@/lib/opportunities/growth-side-hustle-runtime'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 },
    )
  }

  try {
    const input = await request.json() as GrowthSideHustleFactoryInput
    const result = await ingestGrowthSideHustleOpportunity(user.id, input)

    return NextResponse.json({
      success: true,
      data: {
        opportunity: result.stored.opportunity,
        triageState: result.stored.triageState,
        experimentProposal: result.experimentProposal,
        sideHustleScore: result.sideHustleScore,
        authority: result.authority,
      },
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unable to create Growth opportunity',
    }, { status: 400 })
  }
}

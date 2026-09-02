import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { OpportunityDiscoveryProviderRegistry, OpportunityDiscoveryService } from '@jhadina/opportunity-core'
import { SupabaseOpportunityRepository } from '@/lib/government-opportunities/supabase-oce-opportunity-repository'
import { SamOpportunityDiscoveryProvider } from '@/lib/government-opportunities/sam-opportunity-discovery-provider'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 })

  let body: { since?: string; limit?: number; keyword?: string } = {}
  try {
    body = await request.json()
  } catch {
    // Empty body is valid; provider defaults apply.
  }

  const repository = new SupabaseOpportunityRepository()
  const provider = new SamOpportunityDiscoveryProvider({
    limit: Math.min(Math.max(body.limit ?? 25, 1), 100),
    keyword: body.keyword?.trim() || undefined,
  })
  const registry = new OpportunityDiscoveryProviderRegistry([provider])
  const service = new OpportunityDiscoveryService(repository, registry)

  try {
    const result = await service.run({ since: body.since })
    return NextResponse.json({ ok: true, source: provider.source.id, result })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Opportunity discovery failed' }, { status: 503 })
  }
}

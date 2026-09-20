import type { Opportunity, OpportunityRepository, OpportunityStatus } from '@jhadina/growth-core'
import { createClient } from '@/lib/supabase/server'

type OpportunityRow = {
  id: string
  user_id: string
  title: string
  description: string
  opportunity_class: Opportunity['class']
  strategy: Opportunity['strategy']
  source_type: Opportunity['source']['type']
  source_name: string
  source_url: string | null
  source_external_id: string | null
  buyer: Opportunity['buyer'] | null
  problem: string | null
  evidence: Opportunity['evidence']
  economics: Opportunity['economics']
  score: Opportunity['score'] | null
  match: Opportunity['match'] | null
  outcome: Opportunity['outcome'] | null
  status: OpportunityStatus
  deadline: string | null
  requires_approval: boolean
  created_at: string
  updated_at: string
}

function toDomain(row: OpportunityRow): Opportunity {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    class: row.opportunity_class,
    strategy: row.strategy,
    source: {
      type: row.source_type,
      name: row.source_name,
      url: row.source_url ?? undefined,
      externalId: row.source_external_id ?? undefined,
    },
    buyer: row.buyer ?? undefined,
    problem: row.problem ?? undefined,
    evidence: row.evidence,
    economics: row.economics,
    score: row.score ?? undefined,
    match: row.match ?? undefined,
    outcome: row.outcome ?? undefined,
    status: row.status,
    deadline: row.deadline ?? undefined,
    requiresApproval: row.requires_approval,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toRow(opportunity: Opportunity): OpportunityRow {
  return {
    id: opportunity.id,
    user_id: opportunity.userId,
    title: opportunity.title,
    description: opportunity.description,
    opportunity_class: opportunity.class,
    strategy: opportunity.strategy,
    source_type: opportunity.source.type,
    source_name: opportunity.source.name,
    source_url: opportunity.source.url ?? null,
    source_external_id: opportunity.source.externalId ?? null,
    buyer: opportunity.buyer ?? null,
    problem: opportunity.problem ?? null,
    evidence: opportunity.evidence,
    economics: opportunity.economics,
    score: opportunity.score ?? null,
    match: opportunity.match ?? null,
    outcome: opportunity.outcome ?? null,
    status: opportunity.status,
    deadline: opportunity.deadline ?? null,
    requires_approval: opportunity.requiresApproval,
    created_at: opportunity.createdAt,
    updated_at: opportunity.updatedAt,
  }
}

export class SupabaseOpportunityRepository implements OpportunityRepository {
  async getById(id: string): Promise<Opportunity | null> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('jhadina_opportunities')
      .select('*')
      .eq('id', id)
      .maybeSingle<OpportunityRow>()

    if (error) throw new Error(`Failed to load opportunity: ${error.message}`)
    return data ? toDomain(data) : null
  }

  async list(input?: {
    userId?: string
    status?: OpportunityStatus
    sourceType?: Opportunity['source']['type']
  }): Promise<Opportunity[]> {
    const supabase = await createClient()
    let query = supabase
      .from('jhadina_opportunities')
      .select('*')
      .order('updated_at', { ascending: false })

    if (input?.userId) query = query.eq('user_id', input.userId)
    if (input?.status) query = query.eq('status', input.status)
    if (input?.sourceType) query = query.eq('source_type', input.sourceType)

    const { data, error } = await query.returns<OpportunityRow[]>()
    if (error) throw new Error(`Failed to list opportunities: ${error.message}`)
    return (data ?? []).map(toDomain)
  }

  async upsert(opportunity: Opportunity): Promise<Opportunity> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('jhadina_opportunities')
      .upsert(toRow(opportunity), { onConflict: 'id' })
      .select('*')
      .single<OpportunityRow>()

    if (error) throw new Error(`Failed to persist opportunity: ${error.message}`)
    return toDomain(data)
  }

  async updateStatus(id: string, status: OpportunityStatus, updatedAt: string): Promise<Opportunity> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('jhadina_opportunities')
      .update({ status, updated_at: updatedAt })
      .eq('id', id)
      .select('*')
      .single<OpportunityRow>()

    if (error) throw new Error(`Failed to update opportunity status: ${error.message}`)
    return toDomain(data)
  }
}

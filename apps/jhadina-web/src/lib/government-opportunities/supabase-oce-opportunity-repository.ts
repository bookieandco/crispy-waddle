import type { Opportunity, OpportunityRepository, OpportunityStatus } from '@jhadina/opportunity-core/src/opportunity-repository'
import { createServiceRoleClient } from '../supabase/service-role'

function serviceClient() {
  const client = createServiceRoleClient()
  if (!client) throw new Error('Supabase service-role configuration is missing')
  return client
}

export class SupabaseOpportunityRepository implements OpportunityRepository {
  async get(id: string): Promise<Opportunity | undefined> {
    const { data, error } = await serviceClient()
      .from('oce_opportunities')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(`Opportunity persistence failed: ${error.message}`)
    return data ? toOpportunity(data) : undefined
  }

  async listByIds(ids: string[]): Promise<Opportunity[]> {
    if (ids.length === 0) return []
    const { data, error } = await serviceClient()
      .from('oce_opportunities')
      .select('*')
      .in('id', ids)
    if (error) throw new Error(`Opportunity persistence failed: ${error.message}`)
    return (data ?? []).map(toOpportunity)
  }

  async listByStatus(status: OpportunityStatus): Promise<Opportunity[]> {
    const { data, error } = await serviceClient()
      .from('oce_opportunities')
      .select('*')
      .eq('status', status)
      .order('updated_at', { ascending: false })
    if (error) throw new Error(`Opportunity persistence failed: ${error.message}`)
    return (data ?? []).map(toOpportunity)
  }

  async save(opportunity: Opportunity): Promise<Opportunity> {
    const { data, error } = await serviceClient()
      .from('oce_opportunities')
      .upsert(toOpportunityRow(opportunity), { onConflict: 'id' })
      .select('*')
      .single()
    if (error) throw new Error(`Opportunity persistence failed: ${error.message}`)
    return toOpportunity(data)
  }
}

const toOpportunityRow = (opportunity: Opportunity) => ({
  id: opportunity.id,
  title: opportunity.title,
  family: opportunity.family,
  type: opportunity.type,
  description: opportunity.description ?? null,
  source_url: opportunity.sourceUrl,
  source_name: opportunity.sourceName,
  source_id: opportunity.sourceId ?? null,
  source_identity: opportunity.sourceId ?? opportunity.sourceUrl,
  amount: opportunity.amount ?? null,
  deadline: opportunity.deadline ?? null,
  jurisdiction: opportunity.jurisdiction ?? null,
  eligibility: opportunity.eligibility ?? null,
  requirements: opportunity.requirements ?? [],
  scoring_rubric: opportunity.scoringRubric ?? null,
  claims: opportunity.claims,
  evidence: opportunity.evidence,
  verification_status: opportunity.verificationStatus,
  verification_decision: null,
  source_confidence: opportunity.sourceConfidence,
  fit_score: opportunity.fitScore ?? null,
  opportunity_score: opportunity.opportunityScore ?? null,
  expected_value: opportunity.expectedValue ?? null,
  effort_score: opportunity.effortScore ?? null,
  risk_flags: opportunity.riskFlags,
  brokerability: opportunity.brokerability ?? null,
  status: opportunity.status,
  created_at: opportunity.createdAt,
  updated_at: opportunity.updatedAt,
})

const toOpportunity = (row: any): Opportunity => ({
  id: row.id,
  title: row.title,
  family: row.family,
  type: row.type,
  description: row.description ?? undefined,
  sourceUrl: row.source_url,
  sourceName: row.source_name,
  sourceId: row.source_id ?? undefined,
  amount: row.amount ?? undefined,
  deadline: row.deadline ?? undefined,
  jurisdiction: row.jurisdiction ?? undefined,
  eligibility: row.eligibility ?? undefined,
  requirements: row.requirements ?? [],
  scoringRubric: row.scoring_rubric ?? undefined,
  claims: row.claims ?? [],
  evidence: row.evidence ?? [],
  verificationStatus: row.verification_status,
  sourceConfidence: Number(row.source_confidence),
  fitScore: row.fit_score == null ? undefined : Number(row.fit_score),
  opportunityScore: row.opportunity_score == null ? undefined : Number(row.opportunity_score),
  expectedValue: row.expected_value == null ? undefined : Number(row.expected_value),
  effortScore: row.effort_score == null ? undefined : Number(row.effort_score),
  riskFlags: row.risk_flags ?? [],
  brokerability: row.brokerability ?? undefined,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

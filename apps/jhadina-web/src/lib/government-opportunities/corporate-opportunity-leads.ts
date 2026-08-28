export interface CorporateOpportunityLead {
  id: string
  opportunityId: string
  entityId: string
  score: number
  signals: string[]
  evidenceIds: string[]
  scoringVersion: string
  createdAt: string
  reviewStatus: 'PENDING' | 'REVIEWED' | 'DISMISSED'
}

export interface CorporateOpportunityLeadStore {
  upsert(lead: CorporateOpportunityLead): Promise<void>
  get(opportunityId: string, entityId: string): Promise<CorporateOpportunityLead | null>
  listForOpportunity(opportunityId: string): Promise<CorporateOpportunityLead[]>
}

export class InMemoryCorporateOpportunityLeadStore implements CorporateOpportunityLeadStore {
  private readonly leads = new Map<string, CorporateOpportunityLead>()
  private key(opportunityId: string, entityId: string): string { return `${opportunityId}|${entityId}` }
  async upsert(lead: CorporateOpportunityLead): Promise<void> {
    if (!lead.opportunityId || !lead.entityId) throw new Error('opportunityId and entityId are required')
    if (lead.score < 0 || lead.score > 100) throw new Error('score must be between 0 and 100')
    this.leads.set(this.key(lead.opportunityId, lead.entityId), lead)
  }
  async get(opportunityId: string, entityId: string): Promise<CorporateOpportunityLead | null> { return this.leads.get(this.key(opportunityId, entityId)) ?? null }
  async listForOpportunity(opportunityId: string): Promise<CorporateOpportunityLead[]> { return [...this.leads.values()].filter((lead) => lead.opportunityId === opportunityId).sort((a, b) => b.score - a.score) }
}

export function createCorporateOpportunityLead(input: Omit<CorporateOpportunityLead, 'id' | 'createdAt' | 'reviewStatus'> & { id?: string; createdAt?: string; reviewStatus?: CorporateOpportunityLead['reviewStatus'] }): CorporateOpportunityLead {
  if (!input.opportunityId || !input.entityId) throw new Error('opportunityId and entityId are required')
  return { ...input, id: input.id ?? `${input.opportunityId}|${input.entityId}`, createdAt: input.createdAt ?? new Date().toISOString(), reviewStatus: input.reviewStatus ?? 'PENDING' }
}

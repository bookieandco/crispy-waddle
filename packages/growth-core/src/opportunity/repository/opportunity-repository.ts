import type { Opportunity } from '../domain/opportunity.js'
import type { OpportunityStatus } from '../domain/opportunity-status.js'

export interface OpportunityRepository {
  getById(id: string): Promise<Opportunity | null>
  list(input?: {
    userId?: string
    status?: OpportunityStatus
    sourceType?: Opportunity['source']['type']
  }): Promise<Opportunity[]>
  upsert(opportunity: Opportunity): Promise<Opportunity>
  updateStatus(id: string, status: OpportunityStatus, updatedAt: string): Promise<Opportunity>
}

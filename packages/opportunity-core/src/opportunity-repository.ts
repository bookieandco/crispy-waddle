import type { Opportunity, OpportunityStatus } from './domain/opportunity.js'

export interface OpportunityRepository {
  get(id: string): Promise<Opportunity | undefined>
  listByIds(ids: string[]): Promise<Opportunity[]>
  listByStatus(status: OpportunityStatus): Promise<Opportunity[]>
  save(opportunity: Opportunity): Promise<Opportunity>
}

const clone = <T>(value: T): T => value === undefined ? value : structuredClone(value)

export class InMemoryOpportunityRepository implements OpportunityRepository {
  private readonly opportunities = new Map<string, Opportunity>()

  async get(id: string) {
    return clone(this.opportunities.get(id))
  }

  async listByIds(ids: string[]) {
    const wanted = new Set(ids)
    return [...this.opportunities.values()].filter((opportunity) => wanted.has(opportunity.id)).map(clone)
  }

  async listByStatus(status: OpportunityStatus) {
    return [...this.opportunities.values()].filter((opportunity) => opportunity.status === status).map(clone)
  }

  async save(opportunity: Opportunity) {
    this.opportunities.set(opportunity.id, clone(opportunity))
    return clone(opportunity)
  }
}

import type { Opportunity } from './domain/opportunity.js'
import type { OpportunitySource } from './domain/source.js'
import type { OpportunityRepository } from './opportunity-repository.js'

export type DiscoveredOpportunity = {
  opportunity: Opportunity
  source: OpportunitySource
  externalId?: string
}

export interface OpportunityDiscoveryProvider {
  readonly source: OpportunitySource
  discover(input?: { since?: string }): Promise<DiscoveredOpportunity[]>
}

export type OpportunityDiscoveryResult = {
  discovered: number
  persisted: number
  rejected: number
  opportunityIds: string[]
  errors: string[]
}

export class OpportunityDiscoveryService {
  constructor(
    private readonly repository: OpportunityRepository,
    private readonly providers: readonly OpportunityDiscoveryProvider[],
  ) {}

  async run(input?: { since?: string }): Promise<OpportunityDiscoveryResult> {
    let discovered = 0
    let persisted = 0
    let rejected = 0
    const opportunityIds: string[] = []
    const errors: string[] = []

    for (const provider of this.providers) {
      let records: DiscoveredOpportunity[]
      try {
        records = await provider.discover(input)
      } catch (error) {
        errors.push(`${provider.source.id}: ${error instanceof Error ? error.message : String(error)}`)
        continue
      }

      discovered += records.length
      for (const record of records) {
        const validationError = validateDiscoveredOpportunity(record)
        if (validationError) {
          rejected += 1
          errors.push(`${provider.source.id}: ${validationError}`)
          continue
        }

        await this.repository.save(record.opportunity)
        persisted += 1
        opportunityIds.push(record.opportunity.id)
      }
    }

    return { discovered, persisted, rejected, opportunityIds, errors }
  }
}

export function validateDiscoveredOpportunity(record: DiscoveredOpportunity): string | undefined {
  const { opportunity, source } = record
  if (opportunity.sourceId !== source.id) return 'opportunity sourceId does not match provider source'
  if (!opportunity.sourceUrl) return 'sourceUrl is required'
  if (!opportunity.sourceName) return 'sourceName is required'
  if (opportunity.sourceConfidence < 0 || opportunity.sourceConfidence > 1) return 'sourceConfidence must be between 0 and 1'
  if (opportunity.claims.length === 0) return 'at least one provenance claim is required'
  if (opportunity.evidence.length === 0) return 'at least one evidence record is required'
  return undefined
}

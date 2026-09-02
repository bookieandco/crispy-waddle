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

export class OpportunityDiscoveryProviderRegistry {
  private readonly providersBySourceId: ReadonlyMap<string, OpportunityDiscoveryProvider>

  constructor(providers: readonly OpportunityDiscoveryProvider[]) {
    const bySourceId = new Map<string, OpportunityDiscoveryProvider>()

    for (const provider of providers) {
      if (!provider.source.active) {
        throw new Error(`inactive opportunity source cannot be registered: ${provider.source.id}`)
      }
      if (bySourceId.has(provider.source.id)) {
        throw new Error(`duplicate opportunity discovery provider source: ${provider.source.id}`)
      }
      bySourceId.set(provider.source.id, provider)
    }

    this.providersBySourceId = bySourceId
  }

  list(): readonly OpportunityDiscoveryProvider[] {
    return [...this.providersBySourceId.values()]
  }

  get(sourceId: string): OpportunityDiscoveryProvider | undefined {
    return this.providersBySourceId.get(sourceId)
  }
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
    providers: readonly OpportunityDiscoveryProvider[] | OpportunityDiscoveryProviderRegistry,
  ) {
    this.providers = providers instanceof OpportunityDiscoveryProviderRegistry ? providers.list() : new OpportunityDiscoveryProviderRegistry(providers).list()
  }

  private readonly providers: readonly OpportunityDiscoveryProvider[]

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

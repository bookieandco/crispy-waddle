export type OpportunityVertical =
  | 'government'
  | 'recovery'
  | 'employment'
  | 'affiliate'
  | 'pod'
  | 'dropshipping'
  | 'creator'
  | 'digital_product'
  | 'services'

export type OpportunityProviderReadiness = 'live' | 'adapter_ready' | 'contract_only' | 'disabled'
export type OpportunityProviderCapability = 'discover' | 'normalize' | 'research' | 'execute_handoff'

export type OpportunityProviderDescriptor = {
  id: string
  vertical: OpportunityVertical
  sourceId: string
  adapterKey: string
  readiness: OpportunityProviderReadiness
  capabilities: OpportunityProviderCapability[]
  executionOwner?: string
  notes?: string
}

/**
 * Canonical provider registry. "contract_only" means the source family is modeled
 * but no live external feed is claimed. "adapter_ready" means Jhadina has a
 * normalization boundary but still may need credentials/runtime wiring.
 */
export const CANONICAL_OPPORTUNITY_PROVIDERS: readonly OpportunityProviderDescriptor[] = [
  {
    id: 'provider:sam.gov',
    vertical: 'government',
    sourceId: 'us.sam.gov',
    adapterKey: 'sam.gov',
    readiness: 'adapter_ready',
    capabilities: ['discover', 'normalize', 'research', 'execute_handoff'],
    executionOwner: 'Opportunity/contract pursuit governance',
  },
  {
    id: 'provider:overageos',
    vertical: 'recovery',
    sourceId: 'jhadina.overageos',
    adapterKey: 'overageos',
    readiness: 'adapter_ready',
    capabilities: ['discover', 'normalize', 'research', 'execute_handoff'],
    executionOwner: 'OverageOS',
  },
  {
    id: 'provider:placement-jobs',
    vertical: 'employment',
    sourceId: 'jhadina.placement.jobs',
    adapterKey: 'placement.external-jobs',
    readiness: 'contract_only',
    capabilities: ['normalize', 'research', 'execute_handoff'],
    executionOwner: 'Placement Core',
    notes: 'No live external job-board feed is claimed by this registry.',
  },
  {
    id: 'provider:growth-affiliate',
    vertical: 'affiliate',
    sourceId: 'jhadina.growth.affiliate',
    adapterKey: 'growth.affiliate',
    readiness: 'contract_only',
    capabilities: ['normalize', 'research', 'execute_handoff'],
    executionOwner: 'Growth/Commerce',
    notes: 'Affiliate-network discovery credentials/feed remain unbound.',
  },
  {
    id: 'provider:pupsonstuff-pod',
    vertical: 'pod',
    sourceId: 'jhadina.pupsonstuff',
    adapterKey: 'pupsonstuff.pod',
    readiness: 'adapter_ready',
    capabilities: ['normalize', 'research', 'execute_handoff'],
    executionOwner: 'PupsonStuff',
  },
  {
    id: 'provider:commerce-dropshipping',
    vertical: 'dropshipping',
    sourceId: 'jhadina.commerce.dropshipping',
    adapterKey: 'commerce.dropshipping',
    readiness: 'contract_only',
    capabilities: ['normalize', 'research', 'execute_handoff'],
    executionOwner: 'Commerce',
    notes: 'Supplier/product feeds are not yet bound to a live provider.',
  },
  {
    id: 'provider:growth-creator',
    vertical: 'creator',
    sourceId: 'jhadina.growth.creator',
    adapterKey: 'growth.creator',
    readiness: 'adapter_ready',
    capabilities: ['discover', 'normalize', 'research', 'execute_handoff'],
    executionOwner: 'Growth/Director',
  },
  {
    id: 'provider:digital-products',
    vertical: 'digital_product',
    sourceId: 'jhadina.commerce.digital-products',
    adapterKey: 'commerce.digital-products',
    readiness: 'contract_only',
    capabilities: ['normalize', 'research', 'execute_handoff'],
    executionOwner: 'Commerce',
  },
  {
    id: 'provider:services',
    vertical: 'services',
    sourceId: 'jhadina.placement.services',
    adapterKey: 'placement.services',
    readiness: 'contract_only',
    capabilities: ['normalize', 'research', 'execute_handoff'],
    executionOwner: 'Placement/Commerce',
  },
] as const

export function opportunityProvider(id: string): OpportunityProviderDescriptor | undefined {
  return CANONICAL_OPPORTUNITY_PROVIDERS.find((provider) => provider.id === id)
}

export function opportunityProvidersForVertical(vertical: OpportunityVertical): OpportunityProviderDescriptor[] {
  return CANONICAL_OPPORTUNITY_PROVIDERS.filter((provider) => provider.vertical === vertical)
}

export function assertOpportunityProviderRegistry(): void {
  const ids = new Set<string>()
  for (const provider of CANONICAL_OPPORTUNITY_PROVIDERS) {
    if (ids.has(provider.id)) throw new Error(`Duplicate opportunity provider id: ${provider.id}`)
    ids.add(provider.id)
    if (provider.capabilities.includes('discover') && provider.readiness === 'contract_only') {
      throw new Error(`Contract-only provider cannot claim live discovery: ${provider.id}`)
    }
  }
}

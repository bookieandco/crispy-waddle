import { assertOpportunityProviderRegistry, opportunityProvider, opportunityProvidersForVertical } from './provider.js'

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message)
}

assertOpportunityProviderRegistry()
assert(opportunityProvider('provider:overageos')?.executionOwner === 'OverageOS', 'Recovery execution must remain owned by OverageOS')
assert(opportunityProvider('provider:placement-jobs')?.readiness === 'contract_only', 'External job discovery must not be represented as live')
assert(opportunityProvider('provider:commerce-dropshipping')?.readiness === 'contract_only', 'Dropshipping suppliers must not be represented as live')
assert(opportunityProvidersForVertical('creator').some((provider) => provider.id === 'provider:growth-creator'), 'Creator vertical must resolve to Growth')

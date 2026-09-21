import { assertOpportunityProviderRegistry, opportunityProvider, opportunityProvidersForVertical } from './provider.js'

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message)
}

assertOpportunityProviderRegistry()
assert(opportunityProvider('provider:overageos')?.executionOwner === 'OverageOS', 'Recovery execution must remain owned by OverageOS')
assert(opportunityProvider('provider:placement-jobs')?.readiness === 'contract_only', 'External job discovery must not be represented as live')
assert(opportunityProvider('provider:commerce-dropshipping')?.readiness === 'adapter_ready', 'Dropshipping must reflect its implemented Commerce adapter boundary without claiming a live provider')
assert(opportunityProvidersForVertical('creator').some((provider) => provider.id === 'provider:growth-creator'), 'Creator vertical must resolve to Growth')

assert(opportunityProvider('provider:ai-pod-store')?.readiness === 'contract_only', 'General AI POD must remain distinct from PupsonStuff and not be presented as live')
assert(opportunityProvider('provider:information-broker')?.readiness === 'contract_only', 'Information-broker blueprint must remain modeled but not live')
assert(opportunityProvider('provider:energy-compute')?.readiness === 'disabled', 'Blocked energy/compute experiment must not surface as a live opportunity provider')
assert(opportunityProvidersForVertical('pod').length >= 2, 'PupsonStuff and general AI POD must remain distinct provider paths')

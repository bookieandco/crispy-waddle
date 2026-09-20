import type { EvidenceRef } from '@jhadina/core-spine'
import type { SpatialContextPackage } from './integration.js'

export type SpatialConsumer = 'money' | 'sports' | 'opportunity' | 'courier' | 'safety' | 'research' | 'media'

export type SpatialConsumerProjection = {
  consumer: SpatialConsumer
  authority: 'INTELLIGENCE_ONLY'
  evidence: EvidenceRef[]
  reality: EvidenceRef[]
  observations: EvidenceRef[]
  sourceHealth: string[]
  conflicts: string[]
  uncertainty: string[]
  limitations: string[]
  permittedUses: string[]
  prohibitedUses: string[]
}

const USES: Record<SpatialConsumer, { permitted: string[]; prohibited: string[] }> = {
  money: { permitted: ['exogenous-risk-context', 'infrastructure-disruption-context', 'shipping-and-flight-context'], prohibited: ['trade-execution', 'price-as-world-state', 'spatial-signal-as-order'] },
  sports: { permitted: ['venue-weather-context', 'travel-disruption-context', 'location-context'], prohibited: ['auto-betting', 'result-as-guarantee'] },
  opportunity: { permitted: ['regional-context', 'facility-and-infrastructure-context', 'route-context'], prohibited: ['automatic-outreach', 'source-presence-as-verified-opportunity'] },
  courier: { permitted: ['route-context', 'traffic-context', 'weather-disruption-context'], prohibited: ['automatic-dispatch', 'bypass-delivery-approval'] },
  safety: { permitted: ['hazard-context', 'public-camera-context', 'route-context'], prohibited: ['named-person-surveillance', 'face-recognition', 'plate-identification', 'individual-tracking'] },
  research: { permitted: ['cross-source-corroboration', 'source-health-investigation', 'historical-context'], prohibited: ['raw-source-to-reality-promotion'] },
  media: { permitted: ['map-visualization', 'world-shot-planning', 'spatial-story-context'], prohibited: ['publish-without-rights-check', 'renderer-state-as-fact'] },
}

const copyRefs = (refs: EvidenceRef[]) => refs.map((ref) => ({ ...ref }))

/** Cross-subsystem handoff. Consumers receive bounded intelligence, never spatial execution authority. */
export function projectSpatialContextForConsumer(context: SpatialContextPackage, consumer: SpatialConsumer): SpatialConsumerProjection {
  const uses = USES[consumer]
  return {
    consumer,
    authority: 'INTELLIGENCE_ONLY',
    evidence: copyRefs(context.evidence),
    reality: copyRefs(context.reality),
    observations: copyRefs(context.observations),
    sourceHealth: [...context.sourceHealth],
    conflicts: [...context.conflicts],
    uncertainty: [...context.uncertainty],
    limitations: [...new Set([...context.limitations, 'Spatial context cannot authorize actions in the consuming subsystem.'])],
    permittedUses: [...uses.permitted],
    prohibitedUses: [...uses.prohibited],
  }
}

export const toMoneySpatialIntelligence = (context: SpatialContextPackage): SpatialConsumerProjection => projectSpatialContextForConsumer(context, 'money')
export const toSportsSpatialIntelligence = (context: SpatialContextPackage): SpatialConsumerProjection => projectSpatialContextForConsumer(context, 'sports')
export const toOpportunitySpatialIntelligence = (context: SpatialContextPackage): SpatialConsumerProjection => projectSpatialContextForConsumer(context, 'opportunity')
export const toCourierSpatialIntelligence = (context: SpatialContextPackage): SpatialConsumerProjection => projectSpatialContextForConsumer(context, 'courier')
export const toSafetySpatialIntelligence = (context: SpatialContextPackage): SpatialConsumerProjection => projectSpatialContextForConsumer(context, 'safety')
export const toResearchSpatialIntelligence = (context: SpatialContextPackage): SpatialConsumerProjection => projectSpatialContextForConsumer(context, 'research')
export const toMediaSpatialIntelligence = (context: SpatialContextPackage): SpatialConsumerProjection => projectSpatialContextForConsumer(context, 'media')

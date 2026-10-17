import type { SpatialContextPackage } from './integration.js'

export type SpatialReadOnlyConsumer =
  | 'delia' | 'director' | 'safety' | 'money' | 'sports' | 'opportunity' | 'research'

/**
 * GEV-LIVE.10: read-only, non-executing cross-domain handoff contract.
 * This is a projection of a canonical SpatialContextPackage, NOT an actor,
 * queue, permission, trading signal, alert, or alternate Reality store.
 */
export type SpatialReadOnlyHandoff = {
  kind: 'SPATIAL_READ_ONLY_HANDOFF_V1'
  consumer: SpatialReadOnlyConsumer
  authority: 'READ_ONLY_CONTEXT'
  actionable: false
  writeAllowed: false
  canPublish: false
  canTrade: false
  canWager: false
  canObservePrivateFeeds: false
  observedRefs: string[]
  durableEvidenceRefs: string[]
  admittedRealityRefs: string[]
  verifiedForOperationalUse: false
  sourceHealth: string[]
  evidenceGaps: string[]
  limitations: string[]
}

const consumers = new Set<SpatialReadOnlyConsumer>([
  'delia', 'director', 'safety', 'money', 'sports', 'opportunity', 'research',
])

const boundedIds = (refs: readonly { id: string }[]) => [...new Set(
  refs.filter(ref => typeof ref.id === 'string' && /^[A-Za-z0-9_.:-]{1,240}$/.test(ref.id))
    .map(ref => ref.id),
)].sort().slice(0, 32)

/** Only bounded, structured reference IDs cross system boundaries: never raw geographic
 * coordinates, personal media, credentials, streamed frames or source payloads.
 * A receiver MUST separately authorize every proposed action. */
export function projectSpatialReadOnlyHandoff(
  context: SpatialContextPackage, consumer: SpatialReadOnlyConsumer,
): SpatialReadOnlyHandoff {
  if (!consumers.has(consumer)) throw new Error('SPATIAL_HANDOFF_CONSUMER_UNSUPPORTED')
  const durableEvidenceRefs = boundedIds(context.evidence)
  const admittedRealityRefs = boundedIds(context.reality)
  const observedRefs = boundedIds(context.observations)
  return {
    kind: 'SPATIAL_READ_ONLY_HANDOFF_V1',
    consumer, authority: 'READ_ONLY_CONTEXT',
    actionable: false, writeAllowed: false, canPublish: false, canTrade: false, canWager: false,
    canObservePrivateFeeds: false, verifiedForOperationalUse: false,
    observedRefs, durableEvidenceRefs, admittedRealityRefs,
    sourceHealth: [...new Set(context.sourceHealth.filter(x => typeof x === 'string' && x.length <= 160))].slice(0, 24),
    evidenceGaps: [
      ...(durableEvidenceRefs.length === 0 ? ['NO_DURABLE_EVIDENCE'] : []),
      ...(admittedRealityRefs.length === 0 ? ['NO_ADMITTED_REALITY'] : []),
      ...(context.uncertainty.length ? ['SOURCE_UNCERTAINTY_PRESENT'] : []),
      ...(context.conflicts.length ? ['SPATIAL_CONFLICTS_PRESENT'] : []),
    ],
    limitations: [
      'Spatial context is intelligence only. Any execution, financial decision, publication, observation of private feeds, or action requires separate owner consent and domain approval.',
      'An observed source record is not independently verified durable evidence or admitted Reality.',
      ...context.limitations.filter(x => typeof x === 'string' && x.length <= 240).slice(0, 8),
    ],
  }
}

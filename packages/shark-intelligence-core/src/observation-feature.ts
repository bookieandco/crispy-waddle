import type { SharkObservation } from './observation.js'

export type SharkFusionFeature =
  | 'liquidity'
  | 'holders'
  | 'contract'
  | 'sellability'
  | 'market'
  | 'wallet'
  | 'social'
  | 'migration'

export type SharkFusionObservation = SharkObservation & {
  feature: SharkFusionFeature
  value: number
}

/** Project a normalized observation into the narrower feature vocabulary required by fusion. */
export function projectObservationToFusion(
  observation: SharkObservation,
  feature: SharkFusionFeature,
  value = observation.value,
): SharkFusionObservation {
  if (value === undefined || !Number.isFinite(value)) {
    throw new Error('fusion projection requires a finite numeric value')
  }
  return { ...observation, feature, value }
}

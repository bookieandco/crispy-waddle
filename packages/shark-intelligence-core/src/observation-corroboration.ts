import type { SharkObservation } from './observation.js'

export type SharkObservationCluster = {
  key: string
  observations: SharkObservation[]
  sourceIds: string[]
  corroborationCount: number
}

function normalizeSignal(signal: string): string {
  return signal.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function observationClusterKey(observation: SharkObservation): string {
  return [observation.opportunityId, observation.source, normalizeSignal(observation.signal)].join('|')
}

/** Group equivalent observations while retaining every independent source. */
export function corroborateSharkObservations(observations: SharkObservation[]): SharkObservationCluster[] {
  const clusters = new Map<string, SharkObservationCluster>()
  for (const observation of observations) {
    const key = observationClusterKey(observation)
    const cluster = clusters.get(key)
    if (cluster) {
      cluster.observations.push(observation)
      if (!cluster.sourceIds.includes(observation.sourceId)) cluster.sourceIds.push(observation.sourceId)
      cluster.corroborationCount = cluster.sourceIds.length
    } else {
      clusters.set(key, {
        key,
        observations: [observation],
        sourceIds: [observation.sourceId],
        corroborationCount: 1,
      })
    }
  }
  return [...clusters.values()]
}

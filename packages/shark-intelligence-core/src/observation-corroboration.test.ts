import { describe, expect, it } from 'vitest'
import { corroborateSharkObservations, observationClusterKey } from './observation-corroboration.js'
import type { SharkObservation } from './observation.js'

const base: SharkObservation = {
  id: 'obs-1', opportunityId: 'opp-1', sourceId: 'solana', source: 'onchain',
  observedAt: '2026-01-01T00:00:00.000Z', signal: ' Holder accumulation ', confidence: 0.8, verified: true,
}

describe('Shark observation corroboration', () => {
  it('clusters equivalent signals while retaining independent sources', () => {
    const result = corroborateSharkObservations([
      base,
      { ...base, id: 'obs-2', sourceId: 'market', signal: 'holder   accumulation' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].observations).toHaveLength(2)
    expect(result[0].sourceIds).toEqual(['solana', 'market'])
    expect(result[0].corroborationCount).toBe(2)
  })

  it('does not merge different opportunities or source categories', () => {
    const result = corroborateSharkObservations([
      base,
      { ...base, id: 'obs-2', opportunityId: 'opp-2', sourceId: 'market', source: 'market' },
      { ...base, id: 'obs-3', sourceId: 'social', source: 'social' },
    ])
    expect(result).toHaveLength(3)
  })

  it('produces deterministic cluster keys', () => {
    expect(observationClusterKey(base)).toBe('opp-1|onchain|holder accumulation')
  })
})

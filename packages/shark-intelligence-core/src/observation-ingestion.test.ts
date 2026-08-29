import { describe, expect, it } from 'vitest'
import { ingestSharkObservations, type SharkObservationSourceAdapter } from './observation-ingestion.js'

describe('Shark observation ingestion', () => {
  it('ingests observations from multiple independent sources', async () => {
    const adapters: SharkObservationSourceAdapter[] = [
      { sourceId: 'solana', source: 'onchain', async observe() { return [{ opportunityId: 'opp-1', sourceId: 'solana', source: 'onchain', observedAt: '2026-01-01T00:00:00.000Z', signal: 'holder accumulation', confidence: 0.9, verified: true }] } },
      { sourceId: 'reddit', source: 'community', async observe() { return [{ opportunityId: 'opp-1', sourceId: 'reddit', source: 'community', observedAt: '2026-01-01T00:01:00.000Z', signal: 'discussion velocity', confidence: 0.7, verified: false }] } },
    ]
    const result = await ingestSharkObservations(adapters)
    expect(result.accepted).toHaveLength(2)
    expect(result.rejected).toHaveLength(0)
  })

  it('rejects invalid observations without aborting the batch', async () => {
    const result = await ingestSharkObservations([{
      sourceId: 'bad-source', source: 'market', async observe() {
        return [{ opportunityId: '', sourceId: '', source: 'market', observedAt: '', signal: '', confidence: 2, verified: false }]
      },
    }])
    expect(result.accepted).toHaveLength(0)
    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0].reason).toContain('invalid Shark observation')
  })

  it('uses adapter identity when an input omits source identity', async () => {
    const result = await ingestSharkObservations([{
      sourceId: 'market-feed', source: 'market', async observe() {
        return [{ opportunityId: 'opp-2', sourceId: '', source: 'market', observedAt: '2026-01-01T00:00:00.000Z', signal: 'price movement', confidence: 0.5, verified: false }]
      },
    }])
    expect(result.accepted[0].sourceId).toBe('market-feed')
  })
})

import { describe, expect, it } from 'vitest'
import { ventureSignalFromTrend, type VentureScoutSeed } from './venture-market-scout-runtime'

const seed: VentureScoutSeed = {
  id: 'pod-test',
  family: 'pod_personalized_commerce',
  query: 'personalized gifts',
  freshnessDays: 30,
}

describe('venture market scout mapping', () => {
  it('creates stable provenance-rich search signals without execution authority', () => {
    const observation = {
      source: 'web' as const,
      title: 'Personalized hometown gift demand',
      url: 'https://example.test/product-cluster',
      observedAt: '2026-10-01T15:00:00.000Z',
      signals: { topic: 'personalized gifts' },
      evidence: ['buyer review velocity increased'],
    }

    const first = ventureSignalFromTrend(seed, observation)
    const second = ventureSignalFromTrend(seed, observation)

    expect(first.signal.id).toBe(second.signal.id)
    expect(first.signal.kind).toBe('search')
    expect(first.signal.sourceRef).toBe(observation.url)
    expect(first.signal.confidence).toBeGreaterThan(0.5)
    expect(first.family).toBe('pod_personalized_commerce')
    expect(first.signal.note).toContain('buyer review velocity increased')
  })

  it('maps non-web observations to social evidence rather than creative replicas', () => {
    const mapped = ventureSignalFromTrend(seed, {
      source: 'tiktok',
      title: 'Gift personalization trend',
      url: 'https://example.test/video',
      observedAt: '2026-10-01T15:00:00.000Z',
      signals: { topic: 'personalized gifts', engagement: 1200 },
      evidence: ['views:5000', 'shares:120'],
    })
    expect(mapped.signal.kind).toBe('social')
    expect(mapped.signal.value).toBe(1200)
    expect(mapped.signal.unit).toBe('engagement')
  })
})

import { describe, expect, it } from 'vitest'
import { ingestOpportunitySources } from './opportunity-ingestion.js'

describe('canonical opportunity ingestion', () => {
  it('converges OverageOS, Growth, and Miner candidates into one queue', async () => {
    const result = ingestOpportunitySources('user-1', {
      overage: [{
        sourceKey: 'washoe',
        externalRecordId: '123',
        sourceName: 'OverageOS',
        sourceUrl: 'https://example.test/overage/123',
        amount: 500,
        currency: 'USD',
        claimantName: 'Example Claimant',
        sourceConfidence: 0.9,
      }],
      growth: [{
        id: 'growth:alpha',
        key: 'alpha',
        rank: 1,
        action: 'test',
        score: 72,
        expectedValue: 400,
        confidence: 0.8,
        rationale: 'Positive contribution signal.',
      }],
      miner: [{
        id: 'content:1',
        title: 'AI workflow opportunity',
        summary: 'Businesses repeatedly pay for this workflow.',
        sourceName: 'Opportunity Miner',
        sourceUrl: 'https://example.test/content/1',
        buyer: 'small businesses',
        problem: 'Manual workflow cost',
        evidenceSummary: 'Observed commercial demand; requires independent validation.',
      }],
    })

    expect(result).toHaveLength(3)
    expect(result.map((item) => item.source.type)).toEqual(['overage', 'market_intelligence', 'content'])
    expect(new Set(result.map((item) => item.id)).size).toBe(3)
  })
})

import { describe, expect, it } from 'vitest'
import { adaptOpportunityEvidence, adaptOpportunityEvidenceSet } from './evidence-adapter.js'
import type { OpportunityEvidence } from '@jhadina/opportunity-core'

const evidence: OpportunityEvidence = {
  id: 'evidence-1',
  sourceId: 'reddit-post-1',
  sourceType: 'secondary',
  sourceName: 'Reddit',
  sourceUrl: 'https://example.com/post',
  capturedAt: '2026-01-01T00:00:00.000Z',
  excerpt: 'Observed market discussion',
  confidence: 0.73,
  verified: false,
}

describe('Opportunity Core → Shark evidence adapter', () => {
  it('preserves source identity, timing, confidence, verification and provenance', () => {
    const result = adaptOpportunityEvidence(evidence)

    expect(result.sourceId).toBe(evidence.sourceId)
    expect(result.sourceType).toBe('research')
    expect(result.observedAt).toBe(evidence.capturedAt)
    expect(result.signal).toBe(evidence.excerpt)
    expect(result.strength).toBe(evidence.confidence)
    expect(result.verified).toBe(false)
    expect(result.metadata).toEqual({
      evidenceId: evidence.id,
      sourceType: evidence.sourceType,
      sourceName: evidence.sourceName,
      sourceUrl: evidence.sourceUrl,
    })
  })

  it('preserves verification independently from confidence', () => {
    const result = adaptOpportunityEvidence({ ...evidence, confidence: 0.99, verified: false })
    expect(result.strength).toBe(0.99)
    expect(result.verified).toBe(false)
  })

  it('adapts evidence sets without dropping entries', () => {
    const second = { ...evidence, id: 'evidence-2', sourceId: 'source-2' }
    expect(adaptOpportunityEvidenceSet([evidence, second])).toHaveLength(2)
  })
})

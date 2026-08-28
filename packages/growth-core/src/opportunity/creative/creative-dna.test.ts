import { describe, expect, it } from 'vitest'
import { createCreativeExperiment, creativeCombinationCount, type CreativeDNA } from './creative-dna.js'

const dna: CreativeDNA = {
  id: 'dna-1', opportunityId: 'opp-1', audience: 'small businesses', pain: 'manual lead follow-up', discovery: 'show the missed-lead problem', demonstration: 'automated follow-up', benefit: 'more captured leads',
  hooks: [{ text: 'You may be losing leads without knowing it.' }, { text: 'What happens to leads after 5 PM?' }],
  bodies: [{ structure: 'problem-proof-solution' }, { structure: 'demo-benefit-proof' }],
  ctas: [{ text: 'Learn more', action: 'learn_more' }, { text: 'Test it', action: 'test' }],
  sourceEvidenceIds: ['e1'], createdAt: '2026-08-28T00:00:00Z', updatedAt: '2026-08-28T00:00:00Z',
}

describe('Creative DNA', () => {
  it('calculates hook × body × CTA combinations', () => expect(creativeCombinationCount(dna)).toBe(8))
  it('creates a human-gated experiment', () => {
    const experiment = createCreativeExperiment(dna)
    expect(experiment.combinations).toBe(8)
    expect(experiment.status).toBe('draft')
    expect(experiment.requiresApproval).toBe(true)
  })
})

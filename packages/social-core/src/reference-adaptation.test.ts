import { describe, expect, it } from 'vitest'
import {
  assessCreativeDistance,
  assessPublishCanary,
  createSocialPublishCanaryPlan,
  validateReferenceCreativeObservation,
} from './reference-adaptation.js'

const reference = validateReferenceCreativeObservation({
  id: 'ref:1',
  sourceUrl: 'https://example.com/reel',
  creator: 'creator',
  format: 'talking-head short',
  hookMechanic: 'specific problem promise',
  promise: 'show a faster workflow',
  storyStructure: ['hook', 'proof', 'steps', 'cta'],
  visualPattern: ['talking head', 'screen capture'],
  rightsState: 'public_reference_only',
  evidenceRefs: ['source:snapshot:1'],
  observedAt: '2026-09-28T18:00:00.000Z',
})

describe('reference adaptation and publish canary', () => {
  it('allows abstract inspiration when configured similarity limits pass', () => {
    const result = assessCreativeDistance({
      reference,
      measurement: {
        verbatimOverlap: 0.01,
        distinctivePhraseOverlap: 0.02,
        shotSequenceSimilarity: 0.2,
        visualIdentitySimilarity: 0.1,
        captionSimilarity: 0.05,
        evidenceRefs: ['distance:1'],
      },
      thresholds: {
        maxVerbatimOverlap: 0.05,
        maxDistinctivePhraseOverlap: 0.05,
        maxShotSequenceSimilarity: 0.4,
        maxVisualIdentitySimilarity: 0.3,
        maxCaptionSimilarity: 0.2,
      },
    })
    expect(result.decision).toBe('INSPIRED')
    expect(result.publicationAuthority).toBe('NONE')
  })

  it('blocks unknown reference rights even when similarity is low', () => {
    const result = assessCreativeDistance({
      reference: { ...reference, rightsState: 'unknown' },
      measurement: {
        verbatimOverlap: 0,
        distinctivePhraseOverlap: 0,
        shotSequenceSimilarity: 0,
        visualIdentitySimilarity: 0,
        captionSimilarity: 0,
        evidenceRefs: ['distance:2'],
      },
      thresholds: {
        maxVerbatimOverlap: 0.1,
        maxDistinctivePhraseOverlap: 0.1,
        maxShotSequenceSimilarity: 0.5,
        maxVisualIdentitySimilarity: 0.5,
        maxCaptionSimilarity: 0.5,
      },
    })
    expect(result.decision).toBe('BLOCKED_RIGHTS')
  })

  it('does not expand distribution until the canary has a published receipt', () => {
    const plan = createSocialPublishCanaryPlan({
      id: 'canary:1',
      assetId: 'asset:1',
      canaryPlatform: 'instagram',
      expansionPlatforms: ['instagram', 'youtube', 'tiktok'],
      createdAt: '2026-09-28T18:00:00.000Z',
    })
    expect(plan.expansionPlatforms).toEqual(['youtube', 'tiktok'])
    expect(assessPublishCanary({ plan, receipts: [] }).canExpand).toBe(false)

    const result = assessPublishCanary({
      plan,
      receipts: [{
        id: 'receipt:1',
        canaryPlanId: plan.id,
        assetId: plan.assetId,
        platform: 'instagram',
        accountId: 'acct:1',
        provider: 'provider',
        providerPostId: 'post:1',
        finalUrl: 'https://example.com/post/1',
        state: 'published',
        captionVersion: 'caption:v1',
        assetVersion: 'asset:v1',
        observedAt: '2026-09-28T18:05:00.000Z',
        evidenceRefs: ['provider-receipt:1'],
      }],
    })
    expect(result.canExpand).toBe(true)
    expect(result.authorizationEffect).toBe('NONE')
  })
})

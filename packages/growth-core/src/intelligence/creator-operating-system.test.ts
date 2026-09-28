import { describe, expect, it } from 'vitest'
import {
  assessAudienceOwnership,
  assessCreatorAutomationEligibility,
  assessProductRelevance,
  buildWorkToContentCandidate,
  detectFunnelBottleneck,
  validateChannelRoleAssignment,
} from './creator-operating-system.js'

describe('creator operating system', () => {
  it('keeps discovery-stage creators human-led', () => {
    const result = assessCreatorAutomationEligibility({
      maturity: 'C0_DISCOVERY',
      repeatableFormatEvidenceRefs: [],
      qualityPassRate: 0.95,
      channelSignalEvidenceRefs: [],
      voiceStable: false,
      formatStable: false,
    })
    expect(result.eligible).toBe(false)
    expect(result.authorizationEffect).toBe('NONE')
  })

  it('turns real work into evidence-backed content candidates', () => {
    const result = buildWorkToContentCandidate({
      event: {
        id: 'work:1',
        kind: 'bug_fix',
        projectId: 'pupsonstuff',
        summary: 'fixed mobile viewport clipping',
        happenedAt: '2026-09-28T18:00:00.000Z',
        evidenceRefs: ['github:commit:1'],
        publishable: true,
        containsSensitiveData: false,
      },
      angle: 'what we learned fixing a mobile product studio',
    })
    expect(result.origin).toBe('operational_evidence')
    expect(result.authority).toBe('CONTENT_CANDIDATE_ONLY')
  })

  it('separates owned and rented audience exposure', () => {
    const result = assessAudienceOwnership([
      {
        id: 'ig',
        kind: 'platform_followers',
        count: 1000,
        owned: false,
        platformDependency: 1,
        evidenceRefs: ['metric:ig'],
      },
      {
        id: 'email',
        kind: 'email_subscribers',
        count: 500,
        owned: true,
        platformDependency: 0.1,
        evidenceRefs: ['metric:email'],
      },
    ])
    expect(result.ownedAudience).toBe(500)
    expect(result.rentedAudience).toBe(1000)
    expect(result.concentrationRisk).toBe('high')
  })

  it('finds the largest measured funnel gap rather than assuming the bottleneck', () => {
    const result = detectFunnelBottleneck([
      { stage: 'awareness', actualRate: 0.9, targetRate: 0.9, evidenceRefs: ['funnel:awareness'] },
      { stage: 'activation', actualRate: 0.2, targetRate: 0.6, evidenceRefs: ['funnel:activation'] },
      { stage: 'purchase', actualRate: 0.35, targetRate: 0.5, evidenceRefs: ['funnel:purchase'] },
    ])
    expect(result.bottleneck).toBe('activation')
    expect(result.authority).toBe('ANALYSIS_ONLY')
  })

  it('does not force a product mention when no relevant capability exists', () => {
    const result = assessProductRelevance({
      contentProblem: 'how to structure a first customer interview',
      directPromotion: false,
      evidenceRefs: ['content:1'],
    })
    expect(result.mode).toBe('no_product')
    expect(result.allowed).toBe(true)
  })

  it('requires evidence for channel role assignments', () => {
    expect(() => validateChannelRoleAssignment({
      channel: 'youtube',
      roles: ['depth'],
      evidenceRefs: [],
      lastVerifiedAt: '2026-09-28T18:00:00.000Z',
    })).toThrow(/evidence/)
  })
})

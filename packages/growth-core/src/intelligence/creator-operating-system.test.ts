import { describe, expect, it } from 'vitest'
import {
  assessAudienceOwnership,
  assessCreatorAutomationEligibility,
  assessFounderDependency,
  assessHandoffReadiness,
  assessOperationalIndependence,
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
    expect(result.concentrationRisk).toBe('medium')
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

  it('measures founder dependency without treating it as authorization', () => {
    const profile = {
      identity: 0.1,
      voice: 0.2,
      relationships: 0.2,
      taste: 0.3,
      research: 0.2,
      approval: 0.2,
      dailyOperations: 0.1,
      evidenceRefs: ['ops:founder-dependency'],
    } as const
    expect(assessFounderDependency(profile)).toBeCloseTo(0.1857, 4)
    const result = assessOperationalIndependence({
      profile,
      founderHoursPerWeek: 1,
      operatorRunnableMaxDependency: 0.4,
      ownerLevelMaxDependency: 0.2,
      ownerLevelMaxHoursPerWeek: 2,
    })
    expect(result.independenceState).toBe('owner_level')
    expect(result.authority).toBe('ANALYSIS_ONLY')
  })

  it('requires a real independent operator trial before handoff readiness', () => {
    const blocked = assessHandoffReadiness({
      workflowEvidenceRefs: ['workflow:1'],
      qualityStandardEvidenceRefs: ['quality:1'],
      exampleEvidenceRefs: ['examples:1'],
      escalationRuleEvidenceRefs: ['escalation:1'],
      operatorTrialEvidenceRefs: [],
      founderCorrectionRate: 0.1,
      maximumFounderCorrectionRate: 0.2,
    })
    expect(blocked.ready).toBe(false)

    const ready = assessHandoffReadiness({
      workflowEvidenceRefs: ['workflow:1'],
      qualityStandardEvidenceRefs: ['quality:1'],
      exampleEvidenceRefs: ['examples:1'],
      escalationRuleEvidenceRefs: ['escalation:1'],
      operatorTrialEvidenceRefs: ['trial:1'],
      founderCorrectionRate: 0.1,
      maximumFounderCorrectionRate: 0.2,
    })
    expect(ready.ready).toBe(true)
    expect(ready.authorizationEffect).toBe('NONE')
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

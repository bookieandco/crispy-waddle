import { describe, expect, it } from 'vitest';
import {
  DIRECTOR_LOCAL_FIRST_HUMAN_MEDIA_POLICY,
  directorHumanMediaProfile,
  directorLocalUgcStackPlan,
  evaluateDirectorHumanMediaCommercialReadiness,
  selectDirectorHumanMediaExecution,
  type DirectorHumanMediaExecutionCandidate,
} from './local-human-media-stack.js';

describe('local human media stack', () => {
  it('folds the requested repos into the canonical local UGC roles without creating another Director', () => {
    const plan = directorLocalUgcStackPlan();
    expect(plan.voice).toBe('coqui-tts-local');
    expect(plan.lipSync).toBe('musetalk-local');
    expect(plan.portraitAnimation).toBe('liveportrait-local');
    expect(plan.talkingHeadFallback).toBe('sadtalker-local');
    expect(plan.architectureReferences).toEqual([
      'open-ai-ugc-reference',
      'avatarai-runtime-reference',
    ]);
    expect(plan.premiumFallbacks).toEqual([
      'muapi-premium',
      'arcads-premium',
    ]);
    expect(plan.executionOrder).toEqual([
      'local-homebase',
      'gpu-burst',
      'metered-external-api',
      'subscription-saas',
    ]);
  });

  it('prefers a healthy commercially admitted local worker over GPU burst and paid external candidates', () => {
    const candidates: DirectorHumanMediaExecutionCandidate[] = [
      {
        id: 'arcads',
        roles: ['lip-sync'],
        executionTier: 'subscription-saas',
        billingModel: 'subscription',
        healthy: true,
        commercialReady: true,
        qualityScore: 1,
        estimatedCostUsd: 1,
      },
      {
        id: 'runpod-musetalk',
        roles: ['lip-sync'],
        executionTier: 'gpu-burst',
        billingModel: 'metered-compute',
        healthy: true,
        commercialReady: true,
        qualityScore: 0.95,
        estimatedCostUsd: 0.08,
      },
      {
        id: 'homebase-musetalk',
        roles: ['lip-sync'],
        executionTier: 'local-homebase',
        billingModel: 'self-hosted',
        healthy: true,
        commercialReady: true,
        qualityScore: 0.9,
        estimatedCostUsd: 0.01,
      },
    ];

    expect(selectDirectorHumanMediaExecution('lip-sync', candidates)?.id)
      .toBe('homebase-musetalk');
  });

  it('uses metered GPU burst when local is unavailable without admitting subscriptions by default', () => {
    const candidates: DirectorHumanMediaExecutionCandidate[] = [
      {
        id: 'homebase-musetalk',
        roles: ['lip-sync'],
        executionTier: 'local-homebase',
        billingModel: 'self-hosted',
        healthy: false,
        commercialReady: true,
      },
      {
        id: 'runpod-musetalk',
        roles: ['lip-sync'],
        executionTier: 'gpu-burst',
        billingModel: 'metered-compute',
        healthy: true,
        commercialReady: true,
      },
      {
        id: 'arcads',
        roles: ['lip-sync'],
        executionTier: 'subscription-saas',
        billingModel: 'subscription',
        healthy: true,
        commercialReady: true,
      },
    ];

    expect(DIRECTOR_LOCAL_FIRST_HUMAN_MEDIA_POLICY.allowSubscriptionSaas).toBe(false);
    expect(selectDirectorHumanMediaExecution('lip-sync', candidates)?.id)
      .toBe('runpod-musetalk');
  });

  it('keeps LivePortrait fail-closed for commercial work until InsightFace detection is replaced and artifacts are proven', () => {
    const profile = directorHumanMediaProfile('liveportrait-local')!;
    expect(evaluateDirectorHumanMediaCommercialReadiness(profile).ready).toBe(false);
    expect(evaluateDirectorHumanMediaCommercialReadiness(profile).reasons)
      .toContain('DIRECTOR_HUMAN_MEDIA_INSIGHTFACE_REPLACEMENT_REQUIRED');

    const admitted = evaluateDirectorHumanMediaCommercialReadiness(profile, {
      replacedComponentIds: ['insightface-detection-models'],
      artifactLicenseEvidenceIds: ['license:liveportrait:runtime-bundle'],
    });
    expect(admitted.ready).toBe(true);
  });

  it('requires per-model license evidence before Coqui voices become commercial production workers', () => {
    const profile = directorHumanMediaProfile('coqui-tts-local')!;
    expect(evaluateDirectorHumanMediaCommercialReadiness(profile).reasons)
      .toContain('DIRECTOR_HUMAN_MEDIA_MODEL_LICENSE_EVIDENCE_REQUIRED');
    expect(evaluateDirectorHumanMediaCommercialReadiness(profile, {
      modelLicenseEvidenceIds: ['license:voice-model:commercial'],
    }).ready).toBe(true);
  });

  it('admits premium service profiles only with external-service evidence while paid tiers remain disabled by default', () => {
    const muapi = directorHumanMediaProfile('muapi-premium')!;
    const arcads = directorHumanMediaProfile('arcads-premium')!;
    expect(evaluateDirectorHumanMediaCommercialReadiness(muapi).ready).toBe(false);
    expect(evaluateDirectorHumanMediaCommercialReadiness(arcads).ready).toBe(false);
    expect(evaluateDirectorHumanMediaCommercialReadiness(muapi, {
      externalServiceEvidenceIds: ['terms:muapi'],
    }).ready).toBe(true);
    expect(evaluateDirectorHumanMediaCommercialReadiness(arcads, {
      externalServiceEvidenceIds: ['terms:arcads'],
    }).ready).toBe(true);
    expect(DIRECTOR_LOCAL_FIRST_HUMAN_MEDIA_POLICY.allowMeteredExternalApi).toBe(false);
    expect(DIRECTOR_LOCAL_FIRST_HUMAN_MEDIA_POLICY.allowSubscriptionSaas).toBe(false);
  });

  it('treats Open-AI-UGC as a workflow reference because generation depends on an external API', () => {
    const profile = directorHumanMediaProfile('open-ai-ugc-reference')!;
    const decision = evaluateDirectorHumanMediaCommercialReadiness(profile);
    expect(profile.integrationMode).toBe('architecture-reference');
    expect(decision.ready).toBe(false);
    expect(decision.reasons).toContain('DIRECTOR_HUMAN_MEDIA_REFERENCE_ONLY');
    expect(decision.reasons).toContain('DIRECTOR_HUMAN_MEDIA_EXTERNAL_SERVICE_REQUIRED');
  });
});

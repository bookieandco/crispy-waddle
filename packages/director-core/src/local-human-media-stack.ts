export type DirectorHumanMediaRole =
  | 'ugc-workflow-reference'
  | 'avatar-runtime-reference'
  | 'lip-sync'
  | 'portrait-animation'
  | 'talking-head-fallback'
  | 'voice-generation'
  | 'whole-ugc-generation';

export type DirectorHumanMediaExecutionTier =
  | 'local-homebase'
  | 'gpu-burst'
  | 'metered-external-api'
  | 'subscription-saas';

export type DirectorHumanMediaBillingModel =
  | 'self-hosted'
  | 'metered-compute'
  | 'metered-api'
  | 'subscription';

export type DirectorHumanMediaIntegrationMode =
  | 'architecture-reference'
  | 'worker-candidate';

export type DirectorHumanMediaCommercialGate =
  | 'external-service-required'
  | 'component-artifact-review'
  | 'replace-noncommercial-component'
  | 'third-party-artifact-review'
  | 'model-license-specific';

export interface DirectorHumanMediaBackendProfile {
  id: string;
  sourceRepository: string;
  role: DirectorHumanMediaRole;
  integrationMode: DirectorHumanMediaIntegrationMode;
  executionTiers: readonly DirectorHumanMediaExecutionTier[];
  billingModel: DirectorHumanMediaBillingModel;
  codeLicense: string;
  commercialGate: DirectorHumanMediaCommercialGate;
  capabilities: readonly string[];
  notes: readonly string[];
}

export interface DirectorHumanMediaLicenseEvidence {
  externalServiceEvidenceIds?: readonly string[];
  artifactLicenseEvidenceIds?: readonly string[];
  modelLicenseEvidenceIds?: readonly string[];
  replacedComponentIds?: readonly string[];
}

export interface DirectorHumanMediaCommercialDecision {
  ready: boolean;
  reasons: readonly string[];
}

export interface DirectorHumanMediaRuntimePolicy {
  preferLocal: boolean;
  allowGpuBurst: boolean;
  allowMeteredExternalApi: boolean;
  allowSubscriptionSaas: boolean;
}

export interface DirectorHumanMediaExecutionCandidate {
  id: string;
  roles: readonly DirectorHumanMediaRole[];
  executionTier: DirectorHumanMediaExecutionTier;
  billingModel: DirectorHumanMediaBillingModel;
  healthy: boolean;
  commercialReady: boolean;
  qualityScore?: number;
  estimatedCostUsd?: number;
}

export const DIRECTOR_LOCAL_FIRST_HUMAN_MEDIA_POLICY: Readonly<DirectorHumanMediaRuntimePolicy> =
  Object.freeze({
    preferLocal: true,
    allowGpuBurst: true,
    allowMeteredExternalApi: false,
    allowSubscriptionSaas: false,
  });

export const DIRECTOR_HUMAN_MEDIA_BACKENDS: readonly DirectorHumanMediaBackendProfile[] =
  Object.freeze([
    Object.freeze({
      id: 'open-ai-ugc-reference',
      sourceRepository: 'Anil-matcha/Open-AI-UGC',
      role: 'ugc-workflow-reference',
      integrationMode: 'architecture-reference',
      executionTiers: Object.freeze(['metered-external-api'] as const),
      billingModel: 'metered-api',
      codeLicense: 'MIT',
      commercialGate: 'external-service-required',
      capabilities: Object.freeze([
        'multi-model-ugc-routing',
        'multi-image-reference-input',
        'async-generation-webhooks',
        'creation-history',
        'usage-credit-accounting',
      ]),
      notes: Object.freeze([
        'Harvest workflow, UI, webhook and multi-model routing patterns only.',
        'Its generation path is MuAPI-backed, so it is not the canonical local runtime.',
        'Do not import its separate SaaS/auth/billing surface into Director Workstation.',
      ]),
    }),
    Object.freeze({
      id: 'muapi-premium',
      sourceRepository: 'Anil-matcha/Open-AI-UGC / MuAPI service',
      role: 'whole-ugc-generation',
      integrationMode: 'worker-candidate',
      executionTiers: Object.freeze(['metered-external-api'] as const),
      billingModel: 'metered-api',
      codeLicense: 'external-service',
      commercialGate: 'external-service-required',
      capabilities: Object.freeze([
        'image-to-video',
        'multi-reference-ugc',
        'async-generation',
        'provider-status-polling',
      ]),
      notes: Object.freeze([
        'Optional metered external fallback only; never the local-first default.',
        'Director must retain Product Truth, rights, spend and QC authority.',
        'Concrete model endpoints are transport configuration, not domain truth.',
      ]),
    }),
    Object.freeze({
      id: 'arcads-premium',
      sourceRepository: 'Arcads public API',
      role: 'whole-ugc-generation',
      integrationMode: 'worker-candidate',
      executionTiers: Object.freeze(['subscription-saas'] as const),
      billingModel: 'subscription',
      codeLicense: 'external-service',
      commercialGate: 'external-service-required',
      capabilities: Object.freeze([
        'ugc-talking-actor',
        'product-video',
        'batch-workflows',
        'multi-language-video',
      ]),
      notes: Object.freeze([
        'Optional premium SaaS fallback/benchmark only; never the local-first default.',
        'Public API credentials and current service terms must be separately admitted.',
        'Director remains responsible for canonical voice/product truth, spend and final QC.',
      ]),
    }),
    Object.freeze({
      id: 'avatarai-runtime-reference',
      sourceRepository: 'PunithVT/ai-avatar-system',
      role: 'avatar-runtime-reference',
      integrationMode: 'architecture-reference',
      executionTiers: Object.freeze(['local-homebase', 'gpu-burst'] as const),
      billingModel: 'self-hosted',
      codeLicense: 'MIT',
      commercialGate: 'component-artifact-review',
      capabilities: Object.freeze([
        'persistent-gpu-worker',
        'sentence-streaming',
        'realtime-lip-sync',
        'voice-cloning-pipeline',
        'local-first-storage',
        'health-and-observability',
      ]),
      notes: Object.freeze([
        'Harvest persistent MuseTalk worker, streaming and health patterns.',
        'Do not duplicate its standalone chat UI, auth, database or scheduler.',
        'Director Workstation and @jhadina/compute-core remain canonical.',
      ]),
    }),
    Object.freeze({
      id: 'musetalk-local',
      sourceRepository: 'TMElyralab/MuseTalk',
      role: 'lip-sync',
      integrationMode: 'worker-candidate',
      executionTiers: Object.freeze(['local-homebase', 'gpu-burst'] as const),
      billingModel: 'self-hosted',
      codeLicense: 'MIT',
      commercialGate: 'component-artifact-review',
      capabilities: Object.freeze([
        'audio-driven-video',
        'realtime-lip-sync',
        'multilingual-lip-sync',
        'identity-preserving-video',
      ]),
      notes: Object.freeze([
        'Primary local lip-sync/video-dubbing candidate.',
        'MuseTalk 1.5 exposes inference, realtime inference and training code.',
        'Production admission still requires exact model/dependency artifact license evidence.',
      ]),
    }),
    Object.freeze({
      id: 'liveportrait-local',
      sourceRepository: 'KlingAIResearch/LivePortrait',
      role: 'portrait-animation',
      integrationMode: 'worker-candidate',
      executionTiers: Object.freeze(['local-homebase', 'gpu-burst'] as const),
      billingModel: 'self-hosted',
      codeLicense: 'MIT',
      commercialGate: 'replace-noncommercial-component',
      capabilities: Object.freeze([
        'portrait-animation',
        'expression-transfer',
        'pose-transfer',
        'identity-preserving-video',
      ]),
      notes: Object.freeze([
        'Use for gesture/expression/head-motion performance, not as Director authority.',
        'Upstream license warns bundled InsightFace detection models are non-commercial research artifacts.',
        'Commercial admission requires replacing those detection models and recording evidence.',
      ]),
    }),
    Object.freeze({
      id: 'sadtalker-local',
      sourceRepository: 'OpenTalker/SadTalker',
      role: 'talking-head-fallback',
      integrationMode: 'worker-candidate',
      executionTiers: Object.freeze(['local-homebase', 'gpu-burst'] as const),
      billingModel: 'self-hosted',
      codeLicense: 'Apache-2.0',
      commercialGate: 'third-party-artifact-review',
      capabilities: Object.freeze([
        'single-image-talking-head',
        'audio-driven-video',
        'full-image-animation',
        'reference-mode',
      ]),
      notes: Object.freeze([
        'Fallback path when the primary lip-sync/performance chain is unavailable or fails QC.',
        'Keep behind Watch/OHBench-style quality checks; it is not the preferred production path.',
        'Third-party model artifacts remain separately license-gated.',
      ]),
    }),
    Object.freeze({
      id: 'coqui-tts-local',
      sourceRepository: 'coqui-ai/TTS',
      role: 'voice-generation',
      integrationMode: 'worker-candidate',
      executionTiers: Object.freeze(['local-homebase', 'gpu-burst'] as const),
      billingModel: 'self-hosted',
      codeLicense: 'MPL-2.0',
      commercialGate: 'model-license-specific',
      capabilities: Object.freeze([
        'text-to-speech',
        'voice-cloning',
        'voice-conversion',
        'multilingual-speech',
        'streaming-speech',
      ]),
      notes: Object.freeze([
        'Use the framework locally, but admit voice models one-by-one.',
        'Code licensing does not establish that every downloadable voice model is commercially usable.',
        'Canonical voice identity, consent/rights evidence and speaker QC remain Director-owned.',
      ]),
    }),
  ]);

export function directorHumanMediaProfile(id: string): DirectorHumanMediaBackendProfile | undefined {
  return DIRECTOR_HUMAN_MEDIA_BACKENDS.find((profile) => profile.id === id);
}

export function evaluateDirectorHumanMediaCommercialReadiness(
  profile: DirectorHumanMediaBackendProfile,
  evidence: DirectorHumanMediaLicenseEvidence = {},
): DirectorHumanMediaCommercialDecision {
  const reasons: string[] = [];
  if (profile.integrationMode !== 'worker-candidate') {
    reasons.push('DIRECTOR_HUMAN_MEDIA_REFERENCE_ONLY');
  }

  switch (profile.commercialGate) {
    case 'external-service-required':
      if (!evidence.externalServiceEvidenceIds?.length) {
        reasons.push('DIRECTOR_HUMAN_MEDIA_EXTERNAL_SERVICE_REQUIRED');
      }
      break;
    case 'component-artifact-review':
    case 'third-party-artifact-review':
      if (!evidence.artifactLicenseEvidenceIds?.length) {
        reasons.push('DIRECTOR_HUMAN_MEDIA_ARTIFACT_LICENSE_EVIDENCE_REQUIRED');
      }
      break;
    case 'replace-noncommercial-component':
      if (!evidence.replacedComponentIds?.includes('insightface-detection-models')) {
        reasons.push('DIRECTOR_HUMAN_MEDIA_INSIGHTFACE_REPLACEMENT_REQUIRED');
      }
      if (!evidence.artifactLicenseEvidenceIds?.length) {
        reasons.push('DIRECTOR_HUMAN_MEDIA_ARTIFACT_LICENSE_EVIDENCE_REQUIRED');
      }
      break;
    case 'model-license-specific':
      if (!evidence.modelLicenseEvidenceIds?.length) {
        reasons.push('DIRECTOR_HUMAN_MEDIA_MODEL_LICENSE_EVIDENCE_REQUIRED');
      }
      break;
  }

  return Object.freeze({
    ready: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)]),
  });
}

function executionTierRank(tier: DirectorHumanMediaExecutionTier, preferLocal: boolean): number {
  if (preferLocal) {
    if (tier === 'local-homebase') return 0;
    if (tier === 'gpu-burst') return 1;
    if (tier === 'metered-external-api') return 2;
    return 3;
  }
  if (tier === 'gpu-burst') return 0;
  if (tier === 'local-homebase') return 1;
  if (tier === 'metered-external-api') return 2;
  return 3;
}

function candidateAllowed(
  candidate: DirectorHumanMediaExecutionCandidate,
  policy: DirectorHumanMediaRuntimePolicy,
): boolean {
  if (!candidate.healthy || !candidate.commercialReady) return false;
  if (candidate.executionTier === 'gpu-burst' && !policy.allowGpuBurst) return false;
  if (candidate.executionTier === 'metered-external-api' && !policy.allowMeteredExternalApi) return false;
  if (candidate.executionTier === 'subscription-saas' && !policy.allowSubscriptionSaas) return false;
  if (candidate.billingModel === 'subscription' && !policy.allowSubscriptionSaas) return false;
  if (candidate.billingModel === 'metered-api' && !policy.allowMeteredExternalApi) return false;
  return true;
}

export function selectDirectorHumanMediaExecution(
  role: DirectorHumanMediaRole,
  candidates: readonly DirectorHumanMediaExecutionCandidate[],
  policy: DirectorHumanMediaRuntimePolicy = DIRECTOR_LOCAL_FIRST_HUMAN_MEDIA_POLICY,
): DirectorHumanMediaExecutionCandidate | undefined {
  const eligible = candidates.filter((candidate) =>
    candidate.roles.includes(role) && candidateAllowed(candidate, policy)
  );
  return [...eligible].sort((a, b) => {
    const tier = executionTierRank(a.executionTier, policy.preferLocal)
      - executionTierRank(b.executionTier, policy.preferLocal);
    if (tier !== 0) return tier;
    const quality = (b.qualityScore ?? 0) - (a.qualityScore ?? 0);
    if (quality !== 0) return quality;
    const cost = (a.estimatedCostUsd ?? Number.POSITIVE_INFINITY)
      - (b.estimatedCostUsd ?? Number.POSITIVE_INFINITY);
    if (cost !== 0) return cost;
    return a.id.localeCompare(b.id);
  })[0];
}

export interface DirectorLocalUgcStackPlan {
  voice: string;
  lipSync: string;
  portraitAnimation: string;
  talkingHeadFallback: string;
  architectureReferences: readonly string[];
  premiumFallbacks: readonly string[];
  executionOrder: readonly DirectorHumanMediaExecutionTier[];
  authority: 'DIRECTOR_LOCAL_UGC_STACK_PLAN';
}

export function directorLocalUgcStackPlan(): DirectorLocalUgcStackPlan {
  return Object.freeze({
    voice: 'coqui-tts-local',
    lipSync: 'musetalk-local',
    portraitAnimation: 'liveportrait-local',
    talkingHeadFallback: 'sadtalker-local',
    architectureReferences: Object.freeze([
      'open-ai-ugc-reference',
      'avatarai-runtime-reference',
    ]),
    premiumFallbacks: Object.freeze([
      'muapi-premium',
      'arcads-premium',
    ]),
    executionOrder: Object.freeze<DirectorHumanMediaExecutionTier[]>([
      'local-homebase',
      'gpu-burst',
      'metered-external-api',
      'subscription-saas',
    ]),
    authority: 'DIRECTOR_LOCAL_UGC_STACK_PLAN',
  });
}

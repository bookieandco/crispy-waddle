import {
  validateCanonicalVoiceIdentity,
  validateGeneratedCanonicalVoice,
  validateSpeakerFingerprintReceipt,
  validateVoiceApprovalReceipt,
  type CanonicalVoiceIdentity,
  type GeneratedCanonicalVoiceArtifact,
  type SpeakerFingerprintReceipt,
  type VoiceIdentityApprovalReceipt,
} from './voice-identity-shared.js';
import { JHADINA_CANONICAL_VOICE_IDENTITY_ID } from './jhadina-voice-identity.js';

export type JhadinaVoiceFinalStatus =
  | 'blocked'
  | 'source-certified'
  | 'production-certified';

export type JhadinaVoiceSourceComponent =
  | 'namesake-reference-corpus'
  | 'personality-rnc-behavior'
  | 'quip-engine'
  | 'banter-bit-engine'
  | 'callback-learning'
  | 'expression-prosody-genome'
  | 'streaming-barge-in'
  | 'cross-surface-binding'
  | 'serious-evidence-firewalls';

export interface JhadinaVoiceSourceReceipt {
  id: string;
  component: JhadinaVoiceSourceComponent;
  evidenceIds: readonly string[];
}

export interface JhadinaVoiceExactHeadCheck {
  name: string;
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped';
  receiptId: string;
}

export interface JhadinaVoiceSourceCertificationEvidence {
  exactHeadSha: string;
  exactHeadChecks: readonly JhadinaVoiceExactHeadCheck[];
  componentReceipts: readonly JhadinaVoiceSourceReceipt[];
}

export interface JhadinaVoiceRuntimeReceipt {
  id: string;
  status: 'ready' | 'degraded' | 'unavailable';
  productionReady: boolean;
  voiceProfileId: string;
  voiceIdentityId: string;
  voiceIdentityStatus: 'candidate' | 'approved' | 'retired';
  providerIds: readonly string[];
  speakerQcReady: boolean;
  speakerQcModelId: string;
  speakerQcModelRevision: string;
  streaming: 'progressive-ndjson' | 'none' | 'other';
}

export interface JhadinaVoiceRegisterTakeReceipt {
  id: string;
  register: 'normal' | 'serious' | 'playful';
  artifact: GeneratedCanonicalVoiceArtifact;
}

export interface JhadinaVoiceForcedDriftReceipt {
  id: string;
  voiceIdentityId: string;
  providerId: string;
  measuredSimilarity: number;
  requiredSimilarity: number;
  rejected: boolean;
}

export interface JhadinaVoiceFailoverReceipt {
  id: string;
  voiceIdentityId: string;
  failedProviderId: string;
  acceptedProviderId: string;
  acceptedSimilarity: number;
  attempted: boolean;
  succeeded: boolean;
}

export interface JhadinaVoiceTimingReceipt {
  id: string;
  firstAudioMs: number;
  bargeInStopMs: number;
  disconnectCancellationPassed: boolean;
}

export interface JhadinaVoiceSurfaceReceipt {
  id: string;
  surface: 'ask' | 'director' | 'desktop' | 'phone' | 'device' | 'social' | 'music' | 'tv' | 'embodied';
  voiceIdentityId: string;
  audioSha256: string;
  speakerSimilarity: number;
}

export interface JhadinaVoiceProductionCertificationEvidence {
  identity: CanonicalVoiceIdentity;
  fingerprint: SpeakerFingerprintReceipt;
  approval: VoiceIdentityApprovalReceipt;
  runtime: JhadinaVoiceRuntimeReceipt;
  registerTakes: readonly JhadinaVoiceRegisterTakeReceipt[];
  forcedDrift: JhadinaVoiceForcedDriftReceipt;
  failover: JhadinaVoiceFailoverReceipt;
  timing: JhadinaVoiceTimingReceipt;
  surfaces: readonly JhadinaVoiceSurfaceReceipt[];
}

export interface JhadinaVoiceFinalEvidence {
  source: JhadinaVoiceSourceCertificationEvidence;
  production?: JhadinaVoiceProductionCertificationEvidence;
}

export interface JhadinaVoiceFinalPolicy {
  minimumIntelligibility: number;
  maximumFirstAudioMs: number;
  maximumBargeInStopMs: number;
  minimumProductionProviders: number;
  requiredLiveSurfaces: readonly JhadinaVoiceSurfaceReceipt['surface'][];
}

export const DEFAULT_JHADINA_VOICE_FINAL_POLICY: JhadinaVoiceFinalPolicy = Object.freeze({
  minimumIntelligibility: 0.90,
  maximumFirstAudioMs: 3500,
  maximumBargeInStopMs: 1200,
  minimumProductionProviders: 2,
  requiredLiveSurfaces: Object.freeze(['ask', 'director'] as const),
});

export interface JhadinaVoiceFinalCheck {
  id: string;
  phase: 'source' | 'production';
  passed: boolean;
  reason: string;
}

export interface JhadinaVoiceFinalDecision {
  status: JhadinaVoiceFinalStatus;
  sourceCertified: boolean;
  productionCertified: boolean;
  checks: readonly JhadinaVoiceFinalCheck[];
  reasons: readonly string[];
  authority: 'JHADINA_CANONICAL_VOICE_FINAL_QC';
}

const REQUIRED_SOURCE_COMPONENTS: readonly JhadinaVoiceSourceComponent[] = Object.freeze([
  'namesake-reference-corpus',
  'personality-rnc-behavior',
  'quip-engine',
  'banter-bit-engine',
  'callback-learning',
  'expression-prosody-genome',
  'streaming-barge-in',
  'cross-surface-binding',
  'serious-evidence-firewalls',
]);

const REQUIRED_EXACT_HEAD_CHECKS = Object.freeze([
  'core-spine',
  'jllm',
  'web',
  'director',
  'social-growth',
] as const);

const SHA40 = /^[a-f0-9]{40}$/i;
const SHA64 = /^[a-f0-9]{64}$/i;

function check(
  id: string,
  phase: 'source' | 'production',
  passed: boolean,
  reason: string,
): JhadinaVoiceFinalCheck {
  return { id, phase, passed, reason };
}

function nonEmpty(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function uniqueNonEmpty(values: readonly string[]): boolean {
  const normalized = values.map(value => value.trim()).filter(Boolean);
  return normalized.length === values.length && new Set(normalized).size === normalized.length;
}

function sourceChecks(
  evidence: JhadinaVoiceSourceCertificationEvidence,
): JhadinaVoiceFinalCheck[] {
  const checks: JhadinaVoiceFinalCheck[] = [];
  const shaPassed = SHA40.test(evidence.exactHeadSha);
  checks.push(check(
    'exact-head-sha',
    'source',
    shaPassed,
    shaPassed ? 'Exact-head Git SHA is present.' : 'Exact-head Git SHA is missing or invalid.',
  ));

  for (const component of REQUIRED_SOURCE_COMPONENTS) {
    const matches = evidence.componentReceipts.filter(receipt => receipt.component === component);
    const first = matches[0];
    const passed = matches.length === 1 &&
      nonEmpty(first?.id) &&
      Boolean(first?.evidenceIds.length) &&
      uniqueNonEmpty(first?.evidenceIds ?? []);
    checks.push(check(
      'source:' + component,
      'source',
      passed,
      passed
        ? 'Source receipt exists for ' + component + '.'
        : 'Exactly one evidence-bound source receipt is required for ' + component + '.',
    ));
  }

  for (const required of REQUIRED_EXACT_HEAD_CHECKS) {
    const matches = evidence.exactHeadChecks.filter(item =>
      item.name.trim().toLowerCase() === required
    );
    const first = matches[0];
    const passed = matches.length === 1 &&
      first?.conclusion === 'success' &&
      nonEmpty(first?.receiptId);
    checks.push(check(
      'exact-head:' + required,
      'source',
      passed,
      passed
        ? 'Exact-head ' + required + ' certification passed.'
        : 'Exact-head ' + required + ' success receipt is required.',
    ));
  }

  return checks;
}

function productionChecks(
  evidence: JhadinaVoiceProductionCertificationEvidence | undefined,
  policy: JhadinaVoiceFinalPolicy,
): JhadinaVoiceFinalCheck[] {
  if (!evidence) {
    return [check(
      'production-evidence',
      'production',
      false,
      'Live acoustic certification evidence has not been supplied.',
    )];
  }

  const checks: JhadinaVoiceFinalCheck[] = [];
  const identityReasons = validateCanonicalVoiceIdentity(evidence.identity);
  const fingerprintReasons = validateSpeakerFingerprintReceipt(evidence.fingerprint);
  const approvalReasons = validateVoiceApprovalReceipt(
    evidence.identity,
    evidence.approval,
    evidence.fingerprint,
  );

  const identityPassed =
    evidence.identity.id === JHADINA_CANONICAL_VOICE_IDENTITY_ID &&
    evidence.identity.status === 'approved' &&
    identityReasons.length === 0;
  checks.push(check(
    'approved-identity',
    'production',
    identityPassed,
    identityPassed
      ? 'Canonical Jhadina identity is approved and internally valid.'
      : 'Approved canonical identity is required: ' + (identityReasons.join(',') || evidence.identity.status) + '.',
  ));

  const fingerprintPassed =
    fingerprintReasons.length === 0 &&
    evidence.identity.speakerFingerprintRefs.includes(evidence.fingerprint.fingerprintRef);
  checks.push(check(
    'speaker-fingerprint',
    'production',
    fingerprintPassed,
    fingerprintPassed
      ? 'Provider-independent speaker fingerprint is valid and admitted.'
      : 'Speaker fingerprint is invalid: ' + fingerprintReasons.join(',') + '.',
  ));

  const approvalPassed =
    approvalReasons.length === 0 &&
    evidence.approval.voiceIdentityId === JHADINA_CANONICAL_VOICE_IDENTITY_ID;
  checks.push(check(
    'explicit-approval',
    'production',
    approvalPassed,
    approvalPassed
      ? 'Explicit voice approval receipt is bound to the canonical identity and fingerprint.'
      : 'Voice approval receipt is invalid: ' + approvalReasons.join(',') + '.',
  ));

  const runtime = evidence.runtime;
  const runtimePassed =
    nonEmpty(runtime.id) &&
    runtime.status === 'ready' &&
    runtime.productionReady &&
    runtime.voiceProfileId === 'jhadina:canonical' &&
    runtime.voiceIdentityId === JHADINA_CANONICAL_VOICE_IDENTITY_ID &&
    runtime.voiceIdentityStatus === 'approved' &&
    runtime.providerIds.length >= policy.minimumProductionProviders &&
    uniqueNonEmpty(runtime.providerIds) &&
    runtime.speakerQcReady &&
    nonEmpty(runtime.speakerQcModelId) &&
    nonEmpty(runtime.speakerQcModelRevision) &&
    runtime.streaming === 'progressive-ndjson';
  checks.push(check(
    'native-runtime',
    'production',
    runtimePassed,
    runtimePassed
      ? 'Native runtime is production-ready with redundant TTS, speaker QC, and progressive streaming.'
      : 'Native runtime must be ready with approved identity, redundant TTS, speaker QC, and progressive streaming.',
  ));

  const takeByRegister = new Map(evidence.registerTakes.map(item => [item.register, item]));
  for (const register of ['normal', 'serious', 'playful'] as const) {
    const take = takeByRegister.get(register);
    const decision = take
      ? validateGeneratedCanonicalVoice(evidence.identity, take.artifact, {
          minimumSpeakerSimilarity: evidence.identity.minimumSpeakerSimilarity,
          minimumIntelligibility: policy.minimumIntelligibility,
        })
      : undefined;
    const passed = Boolean(
      take &&
      nonEmpty(take.id) &&
      decision?.admissible &&
      take.artifact.voiceIdentityId === JHADINA_CANONICAL_VOICE_IDENTITY_ID
    );
    checks.push(check(
      'register-take:' + register,
      'production',
      passed,
      passed
        ? register + ' production take passed identity and intelligibility QC.'
        : register + ' production take is missing or failed canonical voice QC' +
          (decision?.reasons.length ? ': ' + decision.reasons.join(',') : '') + '.',
    ));
  }

  const drift = evidence.forcedDrift;
  const driftPassed =
    nonEmpty(drift.id) &&
    drift.voiceIdentityId === JHADINA_CANONICAL_VOICE_IDENTITY_ID &&
    nonEmpty(drift.providerId) &&
    Number.isFinite(drift.measuredSimilarity) &&
    Number.isFinite(drift.requiredSimilarity) &&
    drift.requiredSimilarity >= evidence.identity.minimumSpeakerSimilarity &&
    drift.measuredSimilarity < drift.requiredSimilarity &&
    drift.rejected;
  checks.push(check(
    'forced-drift-rejection',
    'production',
    driftPassed,
    driftPassed
      ? 'A deliberately off-identity take was rejected below the similarity floor.'
      : 'Forced identity drift must be measured below the required floor and rejected.',
  ));

  const failover = evidence.failover;
  const failoverPassed =
    nonEmpty(failover.id) &&
    failover.voiceIdentityId === JHADINA_CANONICAL_VOICE_IDENTITY_ID &&
    nonEmpty(failover.failedProviderId) &&
    nonEmpty(failover.acceptedProviderId) &&
    failover.failedProviderId !== failover.acceptedProviderId &&
    failover.attempted &&
    failover.succeeded &&
    Number.isFinite(failover.acceptedSimilarity) &&
    failover.acceptedSimilarity >= evidence.identity.minimumSpeakerSimilarity;
  checks.push(check(
    'identity-preserving-failover',
    'production',
    failoverPassed,
    failoverPassed
      ? 'Provider failover preserved canonical identity above the similarity floor.'
      : 'A real provider failure must fail over to another identity-preserving provider.',
  ));

  const timing = evidence.timing;
  const timingPassed =
    nonEmpty(timing.id) &&
    Number.isFinite(timing.firstAudioMs) &&
    timing.firstAudioMs >= 0 &&
    timing.firstAudioMs <= policy.maximumFirstAudioMs &&
    Number.isFinite(timing.bargeInStopMs) &&
    timing.bargeInStopMs >= 0 &&
    timing.bargeInStopMs <= policy.maximumBargeInStopMs &&
    timing.disconnectCancellationPassed;
  checks.push(check(
    'conversation-timing',
    'production',
    timingPassed,
    timingPassed
      ? 'First-audio, barge-in, and disconnect cancellation are within final budgets.'
      : 'Timing must stay within ' + policy.maximumFirstAudioMs +
        'ms first-audio and ' + policy.maximumBargeInStopMs +
        'ms barge-in budgets with disconnect cancellation.',
  ));

  for (const surface of policy.requiredLiveSurfaces) {
    const matches = evidence.surfaces.filter(item => item.surface === surface);
    const first = matches[0];
    const passed = matches.length === 1 &&
      nonEmpty(first?.id) &&
      first?.voiceIdentityId === JHADINA_CANONICAL_VOICE_IDENTITY_ID &&
      SHA64.test(first?.audioSha256 ?? '') &&
      Number.isFinite(first?.speakerSimilarity) &&
      Number(first?.speakerSimilarity) >= evidence.identity.minimumSpeakerSimilarity;
    checks.push(check(
      'surface:' + surface,
      'production',
      passed,
      passed
        ? surface + ' live surface produced the approved Jhadina acoustic identity.'
        : surface + ' requires one hash-bound live output above the canonical speaker-similarity floor.',
    ));
  }

  const surfaceIds = evidence.surfaces.map(item => item.id);
  const uniqueSurfaces = uniqueNonEmpty(surfaceIds);
  checks.push(check(
    'surface-receipt-uniqueness',
    'production',
    uniqueSurfaces,
    uniqueSurfaces
      ? 'Cross-surface receipts are unique.'
      : 'Cross-surface receipts must be non-empty and unique.',
  ));

  return checks;
}

/**
 * Fail-closed JHADINA-VOICE.FINAL evaluator.
 *
 * Source certification and production acoustic certification are intentionally
 * distinct. A green repository cannot manufacture the real speaker approval,
 * provider, latency, drift, or cross-surface receipts needed for production.
 */
export function evaluateJhadinaVoiceFinalCertification(
  evidence: JhadinaVoiceFinalEvidence,
  policy: JhadinaVoiceFinalPolicy = DEFAULT_JHADINA_VOICE_FINAL_POLICY,
): JhadinaVoiceFinalDecision {
  const checks = [
    ...sourceChecks(evidence.source),
    ...productionChecks(evidence.production, policy),
  ];
  const sourceFailed = checks.some(item => item.phase === 'source' && !item.passed);
  const productionFailed = checks.some(item => item.phase === 'production' && !item.passed);
  const sourceCertified = !sourceFailed;
  const productionCertified = sourceCertified && !productionFailed;
  return Object.freeze({
    status: productionCertified
      ? 'production-certified'
      : sourceCertified
        ? 'source-certified'
        : 'blocked',
    sourceCertified,
    productionCertified,
    checks: Object.freeze(checks),
    reasons: Object.freeze(checks.filter(item => !item.passed).map(item => item.reason)),
    authority: 'JHADINA_CANONICAL_VOICE_FINAL_QC' as const,
  });
}

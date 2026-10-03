import { describe, expect, it } from 'vitest';
import {
  evaluateJhadinaVoiceFinalCertification,
  type JhadinaVoiceFinalEvidence,
  type JhadinaVoiceProductionCertificationEvidence,
  type JhadinaVoiceSourceCertificationEvidence,
} from './voice-final-certification.js';
import type {
  CanonicalVoiceIdentity,
  GeneratedCanonicalVoiceArtifact,
  SpeakerFingerprintReceipt,
  VoiceIdentityApprovalReceipt,
} from './voice-identity-shared.js';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);
const D = 'd'.repeat(64);
const E = 'e'.repeat(64);
const F = 'f'.repeat(64);

function sourceEvidence(): JhadinaVoiceSourceCertificationEvidence {
  const components = [
    'namesake-reference-corpus',
    'personality-rnc-behavior',
    'quip-engine',
    'banter-bit-engine',
    'callback-learning',
    'expression-prosody-genome',
    'streaming-barge-in',
    'cross-surface-binding',
    'serious-evidence-firewalls',
  ] as const;
  return {
    exactHeadSha: '1'.repeat(40),
    exactHeadChecks: [
      { name: 'core-spine', conclusion: 'success', receiptId: 'check:core' },
      { name: 'jllm', conclusion: 'success', receiptId: 'check:jllm' },
      { name: 'web', conclusion: 'success', receiptId: 'check:web' },
      { name: 'director', conclusion: 'success', receiptId: 'check:director' },
      { name: 'social-growth', conclusion: 'success', receiptId: 'check:social-growth' },
    ],
    componentReceipts: components.map(component => ({
      id: 'receipt:' + component,
      component,
      evidenceIds: ['evidence:' + component],
    })),
  };
}

function identity(): CanonicalVoiceIdentity {
  return {
    id: 'voice:jhadina:canonical:v1',
    version: 1,
    subject: { type: 'assistant', id: 'jhadina' },
    displayName: 'Jhadina',
    source: 'designed',
    primaryLanguage: 'en-US',
    status: 'approved',
    referenceSamples: [{
      id: 'sample:jhadina:v1',
      assetId: 'asset:jhadina:reference:v1',
      sha256: A,
      language: 'en-US',
      transcript: 'Canonical Jhadina reference.',
      durationSeconds: 18,
      rightsRef: 'rights:jhadina:designed-v1',
      qualityEvidenceIds: ['quality:reference'],
    }],
    providerBindings: [
      {
        id: 'binding:qwen',
        provider: 'qwen3-tts',
        modelId: 'qwen-model-v1',
        providerVoiceRef: 'jhadina-qwen-v1',
        referenceSampleIds: ['sample:jhadina:v1'],
        supportedLanguages: ['en-US'],
        provenanceRefs: ['provider:qwen', 'sample:jhadina:v1'],
      },
      {
        id: 'binding:voxcpm',
        provider: 'voxcpm2',
        modelId: 'voxcpm-model-v1',
        providerVoiceRef: 'jhadina-voxcpm-v1',
        referenceSampleIds: ['sample:jhadina:v1'],
        supportedLanguages: ['en-US'],
        provenanceRefs: ['provider:voxcpm', 'sample:jhadina:v1'],
      },
    ],
    languageVariants: [{
      id: 'variant:jhadina:en-us',
      voiceIdentityId: 'voice:jhadina:canonical:v1',
      language: 'en-US',
      locale: 'en-US',
      accentPolicy: 'preserve-identity',
      providerBindingIds: ['binding:qwen', 'binding:voxcpm'],
    }],
    defaultVariantId: 'variant:jhadina:en-us',
    speakerFingerprintRefs: ['fingerprint:jhadina:v1'],
    minimumSpeakerSimilarity: 0.80,
    approvedAt: '2026-10-03T20:00:00.000Z',
    approvedBy: 'owner',
  };
}

function fingerprint(): SpeakerFingerprintReceipt {
  return {
    id: 'fingerprint-receipt:jhadina:v1',
    subject: { type: 'assistant', id: 'jhadina' },
    sourceAssetId: 'asset:jhadina:reference:v1',
    sourceSha256: A,
    normalizedAudioSha256: B,
    modelId: 'speechbrain/spkrec-ecapa-voxceleb',
    modelRevision: 'ff989f88e92ccc120569763824f8eedd5afc9039',
    embeddingDimensions: 192,
    embeddingSha256: C,
    fingerprintRef: 'fingerprint:jhadina:v1',
    quantization: 'float32',
    sampleRateHz: 16000,
    durationSeconds: 18,
    qualityClaim: false,
    evidenceIds: ['qc:fingerprint'],
    createdAt: '2026-10-03T19:55:00.000Z',
  };
}

function approval(): VoiceIdentityApprovalReceipt {
  return {
    id: 'approval:jhadina:v1',
    voiceIdentityId: 'voice:jhadina:canonical:v1',
    subject: { type: 'assistant', id: 'jhadina' },
    candidateAssetId: 'asset:jhadina:reference:v1',
    candidateSha256: A,
    speakerFingerprintReceiptId: 'fingerprint-receipt:jhadina:v1',
    speakerFingerprintRef: 'fingerprint:jhadina:v1',
    minimumSpeakerSimilarity: 0.80,
    provider: 'qwen3-tts',
    modelId: 'qwen-model-v1',
    providerVoiceRef: 'jhadina-qwen-v1',
    authority: 'VOICE_EXPLICIT_APPROVAL',
    evidenceIds: ['approval:evidence'],
    approvedBy: 'owner',
    approvedAt: '2026-10-03T20:00:00.000Z',
  };
}

function artifact(
  register: 'normal' | 'serious' | 'playful',
  sha: string,
  similarity = 0.91,
): GeneratedCanonicalVoiceArtifact {
  return {
    voiceIdentityId: 'voice:jhadina:canonical:v1',
    providerBindingId: register === 'serious' ? 'binding:voxcpm' : 'binding:qwen',
    audioAssetId: 'asset:take:' + register,
    audioSha256: sha,
    language: 'en-US',
    sampleRateHz: 24000,
    durationSeconds: 8,
    speakerSimilarity: similarity,
    intelligibilityScore: 0.97,
    clippingDetected: false,
    evidenceIds: ['take:' + register, 'qc:' + register],
  };
}

function productionEvidence(): JhadinaVoiceProductionCertificationEvidence {
  return {
    identity: identity(),
    fingerprint: fingerprint(),
    approval: approval(),
    runtime: {
      id: 'runtime:jhadina:voice:1',
      status: 'ready',
      productionReady: true,
      voiceProfileId: 'jhadina:canonical',
      voiceIdentityId: 'voice:jhadina:canonical:v1',
      voiceIdentityStatus: 'approved',
      providerIds: ['qwen3-tts', 'voxcpm2'],
      speakerQcReady: true,
      speakerQcModelId: 'speechbrain/spkrec-ecapa-voxceleb',
      speakerQcModelRevision: 'ff989f88e92ccc120569763824f8eedd5afc9039',
      streaming: 'progressive-ndjson',
    },
    registerTakes: [
      { id: 'take-receipt:normal', register: 'normal', artifact: artifact('normal', D) },
      { id: 'take-receipt:serious', register: 'serious', artifact: artifact('serious', E) },
      { id: 'take-receipt:playful', register: 'playful', artifact: artifact('playful', F) },
    ],
    forcedDrift: {
      id: 'drift:jhadina:1',
      voiceIdentityId: 'voice:jhadina:canonical:v1',
      providerId: 'qwen3-tts',
      measuredSimilarity: 0.61,
      requiredSimilarity: 0.80,
      rejected: true,
    },
    failover: {
      id: 'failover:jhadina:1',
      voiceIdentityId: 'voice:jhadina:canonical:v1',
      failedProviderId: 'qwen3-tts',
      acceptedProviderId: 'voxcpm2',
      acceptedSimilarity: 0.91,
      attempted: true,
      succeeded: true,
    },
    timing: {
      id: 'timing:jhadina:1',
      firstAudioMs: 1180,
      bargeInStopMs: 220,
      disconnectCancellationPassed: true,
    },
    surfaces: [
      {
        id: 'surface:ask:1',
        surface: 'ask',
        voiceIdentityId: 'voice:jhadina:canonical:v1',
        audioSha256: D,
        speakerSimilarity: 0.92,
      },
      {
        id: 'surface:director:1',
        surface: 'director',
        voiceIdentityId: 'voice:jhadina:canonical:v1',
        audioSha256: E,
        speakerSimilarity: 0.90,
      },
    ],
  };
}

function completeEvidence(): JhadinaVoiceFinalEvidence {
  return {
    source: sourceEvidence(),
    production: productionEvidence(),
  };
}

describe('JHADINA-VOICE.FINAL certification', () => {
  it('reports source-certified rather than lying about production when live receipts are absent', () => {
    const decision = evaluateJhadinaVoiceFinalCertification({ source: sourceEvidence() });
    expect(decision.status).toBe('source-certified');
    expect(decision.sourceCertified).toBe(true);
    expect(decision.productionCertified).toBe(false);
    expect(decision.reasons.join(' ')).toContain('Live acoustic certification evidence');
  });

  it('blocks even source certification when a required exact-head or architecture receipt is missing', () => {
    const source = sourceEvidence();
    source.exactHeadChecks = source.exactHeadChecks.filter(item => item.name !== 'jllm');
    source.componentReceipts = source.componentReceipts.filter(
      item => item.component !== 'callback-learning'
    );
    const decision = evaluateJhadinaVoiceFinalCertification({ source });
    expect(decision.status).toBe('blocked');
    expect(decision.sourceCertified).toBe(false);
    expect(decision.checks.find(item => item.id === 'exact-head:jllm')?.passed).toBe(false);
    expect(decision.checks.find(item => item.id === 'source:callback-learning')?.passed).toBe(false);
  });

  it('production-certifies only a fully receipt-bound canonical Jhadina voice', () => {
    const decision = evaluateJhadinaVoiceFinalCertification(completeEvidence());
    expect(decision.status).toBe('production-certified');
    expect(decision.sourceCertified).toBe(true);
    expect(decision.productionCertified).toBe(true);
    expect(decision.reasons).toEqual([]);
    expect(decision.checks.every(item => item.passed)).toBe(true);
  });

  it('rejects a playful take that drifts below the approved speaker floor', () => {
    const evidence = completeEvidence();
    const production = evidence.production!;
    production.registerTakes = production.registerTakes.map(item =>
      item.register === 'playful'
        ? { ...item, artifact: artifact('playful', F, 0.62) }
        : item
    );
    const decision = evaluateJhadinaVoiceFinalCertification(evidence);
    expect(decision.status).toBe('source-certified');
    expect(decision.productionCertified).toBe(false);
    expect(decision.checks.find(item => item.id === 'register-take:playful')?.passed).toBe(false);
  });

  it('rejects candidate identity even if providers and timing look healthy', () => {
    const evidence = completeEvidence();
    evidence.production!.identity = { ...evidence.production!.identity, status: 'candidate' };
    const decision = evaluateJhadinaVoiceFinalCertification(evidence);
    expect(decision.status).toBe('source-certified');
    expect(decision.checks.find(item => item.id === 'approved-identity')?.passed).toBe(false);
  });

  it('requires real conversational timing and disconnect cancellation receipts', () => {
    const evidence = completeEvidence();
    evidence.production!.timing = {
      ...evidence.production!.timing,
      firstAudioMs: 9000,
      bargeInStopMs: 4000,
      disconnectCancellationPassed: false,
    };
    const decision = evaluateJhadinaVoiceFinalCertification(evidence);
    expect(decision.checks.find(item => item.id === 'conversation-timing')?.passed).toBe(false);
    expect(decision.productionCertified).toBe(false);
  });

  it('requires both Ask and Director live outputs to prove cross-surface acoustic reuse', () => {
    const evidence = completeEvidence();
    evidence.production!.surfaces = evidence.production!.surfaces.filter(
      item => item.surface !== 'director'
    );
    const decision = evaluateJhadinaVoiceFinalCertification(evidence);
    expect(decision.checks.find(item => item.id === 'surface:director')?.passed).toBe(false);
    expect(decision.productionCertified).toBe(false);
  });

  it('requires a real below-floor rejection and identity-preserving failover', () => {
    const evidence = completeEvidence();
    evidence.production!.forcedDrift = {
      ...evidence.production!.forcedDrift,
      measuredSimilarity: 0.88,
      rejected: false,
    };
    evidence.production!.failover = {
      ...evidence.production!.failover,
      acceptedProviderId: evidence.production!.failover.failedProviderId,
      succeeded: false,
    };
    const decision = evaluateJhadinaVoiceFinalCertification(evidence);
    expect(decision.checks.find(item => item.id === 'forced-drift-rejection')?.passed).toBe(false);
    expect(decision.checks.find(item => item.id === 'identity-preserving-failover')?.passed).toBe(false);
  });
});

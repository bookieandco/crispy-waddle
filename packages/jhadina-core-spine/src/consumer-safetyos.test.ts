import { describe, expect, it } from 'vitest';
import type { EmergencyPreAuthorizationReceipt } from './emergency-governance.js';
import {
  buildConsumerEvidencePolicy,
  buildConsumerPlatformDisclosure,
  collectConsumerSafetyConfigurationBlockers,
  compileConsumerPersonalSafetyConfiguration,
  CONSUMER_SAFETYOS_VERSION,
  createConsumerSafetyEnrollment,
  evaluateConsumerSafetyOSReadiness,
  planConsumerThreatLevel,
  type ConsumerSafetyEnrollment,
} from './consumer-safetyos.js';

function configuredEnrollment(): ConsumerSafetyEnrollment {
  return {
    version: CONSUMER_SAFETYOS_VERSION,
    enrollmentId: 'enroll-1',
    ownerUserId: 'user-1',
    profileId: 'profile-1',
    protocolId: 'protocol-1',
    activation: {
      manualSosEnabled: true,
      codeWordBindingIds: ['cw-1'],
      silentTriggerEnabled: true,
    },
    contacts: [
      {
        id: 'contact-primary',
        tier: 'primary',
        kind: 'trusted-contact',
        priority: 1,
        enabled: true,
        channels: ['push', 'sms'],
        allowedEvidenceMedia: ['location'],
        includeLocation: true,
      },
      {
        id: 'contact-critical',
        tier: 'critical',
        kind: 'trusted-contact',
        priority: 1,
        enabled: true,
        channels: ['sms', 'call'],
        allowedEvidenceMedia: ['audio', 'video', 'location'],
        includeLocation: true,
      },
    ],
    defaultCheckInSeconds: 900,
    escalation: [
      {
        id: 'notify-primary',
        minimumThreat: 'elevated',
        fromState: 'missed',
        afterSeconds: 0,
        capability: 'emergency.notification.send',
        recipientTiers: ['primary'],
      },
      {
        id: 'notify-critical',
        minimumThreat: 'critical',
        fromState: 'escalating',
        afterSeconds: 60,
        capability: 'emergency.notification.send',
        recipientTiers: ['critical'],
      },
    ],
    spatialContext: {
      enabled: false,
      allowPublicEnvironmentContext: false,
    },
    evidence: {
      captureAudio: false,
      captureVideo: false,
      captureLocation: true,
      rollingBufferSeconds: 0,
      retentionSeconds: 86_400,
      requireOffDeviceCopyBeforeRelease: true,
      releaseMode: 'disabled',
      automaticReleaseOptIn: false,
    },
    externalEmergencyServices: { enabled: false },
  };
}

function authorization(
  id: string,
  recipientIds: readonly string[],
): EmergencyPreAuthorizationReceipt {
  return {
    id,
    userId: 'user-1',
    protocolId: 'protocol-1',
    allowedCapabilities: ['emergency.notification.send'],
    recipientIds,
    issuedAt: '2026-09-27T07:00:00Z',
    expiresAt: '2026-09-28T07:00:00Z',
  };
}

describe('Consumer SafetyOS extraction', () => {
  it('starts privacy-minimal and does not silently enable evidence or external emergency services', () => {
    const enrollment = createConsumerSafetyEnrollment({
      enrollmentId: 'e',
      ownerUserId: 'u',
      profileId: 'p',
      protocolId: 'protocol',
    });
    expect(enrollment.activation.manualSosEnabled).toBe(true);
    expect(enrollment.evidence.captureAudio).toBe(false);
    expect(enrollment.evidence.captureVideo).toBe(false);
    expect(enrollment.evidence.captureLocation).toBe(false);
    expect(enrollment.evidence.releaseMode).toBe('disabled');
    expect(enrollment.externalEmergencyServices.enabled).toBe(false);
    expect(enrollment.spatialContext.enabled).toBe(false);
  });

  it('keeps threat planning advisory while selecting different contact tiers', () => {
    const enrollment = configuredEnrollment();
    expect(planConsumerThreatLevel(enrollment, 'elevated')).toEqual({
      threat: 'elevated',
      escalationIds: ['notify-primary'],
      authority: 'PLAN_ONLY',
    });
    expect(planConsumerThreatLevel(enrollment, 'critical')).toEqual({
      threat: 'critical',
      escalationIds: ['notify-primary', 'notify-critical'],
      authority: 'PLAN_ONLY',
    });
  });

  it('requires existing governed pre-authorization instead of minting authority', () => {
    const enrollment = configuredEnrollment();
    expect(() => compileConsumerPersonalSafetyConfiguration({
      enrollment,
      authorizations: [],
      now: '2026-09-27T08:00:00Z',
    })).toThrow('Missing emergency pre-authorization');

    const compiled = compileConsumerPersonalSafetyConfiguration({
      enrollment,
      authorizations: [
        { escalationId: 'notify-primary', receipt: authorization('auth-primary', ['contact-primary']) },
        { escalationId: 'notify-critical', receipt: authorization('auth-critical', ['contact-critical']) },
      ],
      now: '2026-09-27T08:00:00Z',
    });

    expect(compiled.escalationRules.map((rule) => rule.recipientIds)).toEqual([
      ['contact-primary'],
      ['contact-critical'],
    ]);
    expect(compiled.gev.allowNamedPersonSearch).toBe(false);
    expect(compiled.gev.allowFaceRecognition).toBe(false);
    expect(compiled.gev.allowPlateIdentification).toBe(false);
    expect(compiled.evidence.encryptedAtRest).toBe(true);
    expect(compiled.evidence.requireOffDeviceCopyBeforeRelease).toBe(true);
  });

  it('rejects emergency-service routing without explicit opt-in and jurisdiction/provider policy', () => {
    const enrollment: ConsumerSafetyEnrollment = {
      ...configuredEnrollment(),
      contacts: [
        ...configuredEnrollment().contacts,
        {
          id: 'emergency-provider',
          tier: 'critical',
          kind: 'emergency-service',
          priority: 0,
          enabled: true,
          channels: ['call'],
          allowedEvidenceMedia: [],
          includeLocation: false,
        },
      ],
    };
    expect(collectConsumerSafetyConfigurationBlockers(enrollment)).toContain(
      'emergency-service-not-opted-in:emergency-provider',
    );
  });

  it('keeps critical automatic evidence release locked behind explicit policy and Gate 5', () => {
    const base = configuredEnrollment();
    const enrollment: ConsumerSafetyEnrollment = {
      ...base,
      evidence: {
        ...base.evidence,
        captureAudio: true,
        captureVideo: true,
        releaseMode: 'critical-preauthorized',
        automaticReleaseOptIn: true,
      },
      jurisdictionPolicy: {
        id: 'policy-1',
        region: 'configured-region',
        recordingCapture: 'allowed',
        evidenceRelease: 'allowed',
        externalEmergencyServices: 'restricted',
        observedAt: '2026-09-27T07:00:00Z',
        sourceRef: 'compliance:policy-1',
      },
    };
    expect(collectConsumerSafetyConfigurationBlockers(enrollment)).toEqual([]);
    expect(() => buildConsumerEvidencePolicy(enrollment)).toThrow('SAFETY-PROD-GATE.5');

    const policy = buildConsumerEvidencePolicy(enrollment, {
      admitted: true,
      gateVersion: 'SAFETY-PROD-GATE.5',
      blockers: [],
      evidenceRefs: ['physical:device', 'drill:receipt'],
    });
    expect(policy.release.enabled).toBe(true);
    expect(policy.release.trigger).toBe('critical-escalation');
    expect(policy.release.requireUserConfirmation).toBe(false);
  });

  it('does not represent unavailable device capabilities as active', () => {
    const disclosure = buildConsumerPlatformDisclosure({
      platform: 'ios',
      foregroundAudio: true,
      foregroundVideo: true,
      backgroundAudio: true,
      backgroundVideo: false,
      backgroundLocation: true,
      notifications: true,
      localEncryptedStorage: true,
    });
    expect(disclosure.unavailable).toContain('background video capture');
    expect(disclosure.warnings.join(' ')).toContain('must not represent it as active');
  });

  it('moves through setup, drill, admission and live stages without synthetic promotion', () => {
    const enrollment = configuredEnrollment();

    expect(evaluateConsumerSafetyOSReadiness({
      enrollment,
      setupEvidence: {},
    }).stage).toBe('setup');

    const configured = {
      encryptedProfileRef: 'profile:ciphertext',
      deviceCapabilityRef: 'device:capabilities',
      communicationsProviderRef: 'provider:communications',
      vaultRoundtripRef: 'vault:receipt',
      codeWordVerifierRef: 'codeword:verifier',
    };
    expect(evaluateConsumerSafetyOSReadiness({
      enrollment,
      setupEvidence: configured,
    }).stage).toBe('drill-required');

    const drilled = { ...configured, controlledDrillRef: 'drill:controlled' };
    expect(evaluateConsumerSafetyOSReadiness({
      enrollment,
      setupEvidence: drilled,
    }).stage).toBe('live-admission-required');

    expect(evaluateConsumerSafetyOSReadiness({
      enrollment,
      setupEvidence: drilled,
      gate5: {
        admitted: true,
        gateVersion: 'SAFETY-PROD-GATE.5',
        blockers: [],
        evidenceRefs: ['gate5:receipt'],
      },
    })).toEqual({
      stage: 'live-admitted',
      live: true,
      blockers: [],
    });
  });
});

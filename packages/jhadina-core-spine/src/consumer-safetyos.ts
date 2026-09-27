import type { EmergencyGovernedCapability, EmergencyPreAuthorizationReceipt } from './emergency-governance.js';
import type { EvidenceMediaKind, EvidencePolicyV2 } from './emergency-evidence.js';
import type { PersonalSafetyConfiguration } from './safety-personal-config.js';
import type { SafetyEscalationRule } from './safety-escalation-policy.js';
import type { SafetyPlatformCapabilities } from './safety-platform-capabilities.js';
import type { SafetyProdGate5Result } from './safety-prod-gate-5.js';

export const CONSUMER_SAFETYOS_VERSION = 'CONSUMER-SAFETYOS.v1' as const;

export type ConsumerThreatLevel = 'check-in' | 'elevated' | 'critical';
export type ConsumerContactTier = 'primary' | 'secondary' | 'critical';
export type ConsumerContactKind = 'trusted-contact' | 'professional-service' | 'emergency-service';
export type ConsumerEvidenceReleaseMode = 'disabled' | 'manual-confirmed' | 'critical-preauthorized';
export type ConsumerPolicyDecision = 'allowed' | 'restricted' | 'unknown';
export type ConsumerSafetyOSStage = 'setup' | 'drill-required' | 'live-admission-required' | 'live-admitted';

export interface ConsumerContactReference {
  readonly id: string;
  readonly tier: ConsumerContactTier;
  readonly kind: ConsumerContactKind;
  readonly priority: number;
  readonly enabled: boolean;
  readonly channels: readonly ('push' | 'sms' | 'email' | 'call')[];
  readonly allowedEvidenceMedia: readonly EvidenceMediaKind[];
  readonly includeLocation: boolean;
}

export interface ConsumerJurisdictionPolicyReceipt {
  readonly id: string;
  readonly region: string;
  readonly recordingCapture: ConsumerPolicyDecision;
  readonly evidenceRelease: ConsumerPolicyDecision;
  readonly externalEmergencyServices: ConsumerPolicyDecision;
  readonly observedAt: string;
  readonly sourceRef: string;
}

export interface ConsumerEscalationDraft {
  readonly id: string;
  readonly minimumThreat: 'elevated' | 'critical';
  readonly fromState: 'missed' | 'escalating';
  readonly afterSeconds: number;
  readonly capability: Extract<EmergencyGovernedCapability, 'emergency.notification.send' | 'emergency.evidence.release'>;
  readonly recipientTiers: readonly ConsumerContactTier[];
}

export interface ConsumerSafetyEnrollment {
  readonly version: typeof CONSUMER_SAFETYOS_VERSION;
  readonly enrollmentId: string;
  readonly ownerUserId: string;
  readonly profileId: string;
  readonly protocolId: string;
  readonly activation: {
    readonly manualSosEnabled: boolean;
    readonly codeWordBindingIds: readonly string[];
    readonly silentTriggerEnabled: boolean;
  };
  readonly contacts: readonly ConsumerContactReference[];
  readonly defaultCheckInSeconds: number;
  readonly escalation: readonly ConsumerEscalationDraft[];
  readonly spatialContext: {
    readonly enabled: boolean;
    readonly allowPublicEnvironmentContext: boolean;
  };
  readonly evidence: {
    readonly captureAudio: boolean;
    readonly captureVideo: boolean;
    readonly captureLocation: boolean;
    readonly rollingBufferSeconds: number;
    readonly retentionSeconds: number;
    readonly requireOffDeviceCopyBeforeRelease: true;
    readonly releaseMode: ConsumerEvidenceReleaseMode;
    readonly automaticReleaseOptIn: boolean;
  };
  readonly externalEmergencyServices: {
    readonly enabled: boolean;
    readonly providerRef?: string;
  };
  readonly jurisdictionPolicy?: ConsumerJurisdictionPolicyReceipt;
}

export interface ConsumerAuthorizationBinding {
  readonly escalationId: string;
  readonly receipt: EmergencyPreAuthorizationReceipt;
}

export interface ConsumerSafetySetupEvidence {
  readonly encryptedProfileRef?: string;
  readonly deviceCapabilityRef?: string;
  readonly communicationsProviderRef?: string;
  readonly vaultRoundtripRef?: string;
  readonly codeWordVerifierRef?: string;
  readonly controlledDrillRef?: string;
}

export interface ConsumerSafetyReadiness {
  readonly stage: ConsumerSafetyOSStage;
  readonly live: boolean;
  readonly blockers: readonly string[];
}

export interface ConsumerThreatPlan {
  readonly threat: ConsumerThreatLevel;
  readonly escalationIds: readonly string[];
  readonly authority: 'PLAN_ONLY';
}

export interface ConsumerPlatformDisclosure {
  readonly platform: SafetyPlatformCapabilities['platform'];
  readonly supported: readonly string[];
  readonly unavailable: readonly string[];
  readonly warnings: readonly string[];
}

export interface ConsumerSafetySetupSnapshot {
  readonly ownerUserId: string;
  readonly enrollmentId: string;
  readonly productVersion: typeof CONSUMER_SAFETYOS_VERSION;
  readonly stage: ConsumerSafetyOSStage;
  readonly blockers: readonly string[];
  readonly updatedAt: string;
}

export interface ConsumerSafetySetupStore {
  load(ownerUserId: string): Promise<ConsumerSafetySetupSnapshot | null>;
  save(snapshot: ConsumerSafetySetupSnapshot): Promise<void>;
}

export function createConsumerSafetyEnrollment(input: {
  enrollmentId: string;
  ownerUserId: string;
  profileId: string;
  protocolId: string;
}): ConsumerSafetyEnrollment {
  return {
    version: CONSUMER_SAFETYOS_VERSION,
    enrollmentId: input.enrollmentId,
    ownerUserId: input.ownerUserId,
    profileId: input.profileId,
    protocolId: input.protocolId,
    activation: {
      manualSosEnabled: true,
      codeWordBindingIds: [],
      silentTriggerEnabled: false,
    },
    contacts: [],
    defaultCheckInSeconds: 900,
    escalation: [],
    spatialContext: {
      enabled: false,
      allowPublicEnvironmentContext: false,
    },
    evidence: {
      captureAudio: false,
      captureVideo: false,
      captureLocation: false,
      rollingBufferSeconds: 0,
      retentionSeconds: 86_400,
      requireOffDeviceCopyBeforeRelease: true,
      releaseMode: 'disabled',
      automaticReleaseOptIn: false,
    },
    externalEmergencyServices: { enabled: false },
  };
}

function enabledContacts(enrollment: ConsumerSafetyEnrollment): readonly ConsumerContactReference[] {
  return enrollment.contacts.filter((contact) => contact.enabled);
}

function contactsForTiers(
  enrollment: ConsumerSafetyEnrollment,
  tiers: readonly ConsumerContactTier[],
): readonly ConsumerContactReference[] {
  const wanted = new Set(tiers);
  return enabledContacts(enrollment)
    .filter((contact) => wanted.has(contact.tier))
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

function policyReceiptValid(receipt: ConsumerJurisdictionPolicyReceipt | undefined): boolean {
  if (!receipt) return false;
  return Boolean(
    receipt.id.trim() &&
    receipt.region.trim() &&
    receipt.sourceRef.trim() &&
    Number.isFinite(Date.parse(receipt.observedAt)),
  );
}

export function collectConsumerSafetyConfigurationBlockers(
  enrollment: ConsumerSafetyEnrollment,
): readonly string[] {
  const blockers: string[] = [];
  if (enrollment.version !== CONSUMER_SAFETYOS_VERSION) blockers.push('product-version');
  if (!enrollment.enrollmentId.trim()) blockers.push('enrollment-id');
  if (!enrollment.ownerUserId.trim()) blockers.push('owner-user-id');
  if (!enrollment.profileId.trim()) blockers.push('profile-id');
  if (!enrollment.protocolId.trim()) blockers.push('protocol-id');

  if (!enrollment.activation.manualSosEnabled && enrollment.activation.codeWordBindingIds.length === 0) {
    blockers.push('activation-method');
  }
  if (enrollment.activation.silentTriggerEnabled && enrollment.activation.codeWordBindingIds.length === 0) {
    blockers.push('silent-trigger-codeword');
  }
  if (new Set(enrollment.activation.codeWordBindingIds).size !== enrollment.activation.codeWordBindingIds.length) {
    blockers.push('duplicate-codeword-binding');
  }

  if (!Number.isInteger(enrollment.defaultCheckInSeconds) ||
      enrollment.defaultCheckInSeconds < 60 ||
      enrollment.defaultCheckInSeconds > 86_400) {
    blockers.push('check-in-interval');
  }

  const contactIds = enrollment.contacts.map((contact) => contact.id);
  if (contactIds.some((id) => !id.trim())) blockers.push('contact-id');
  if (new Set(contactIds).size !== contactIds.length) blockers.push('duplicate-contact-id');
  for (const contact of enabledContacts(enrollment)) {
    if (!Number.isInteger(contact.priority) || contact.priority < 0) blockers.push(`contact-priority:${contact.id}`);
    if (contact.channels.length === 0) blockers.push(`contact-channel:${contact.id}`);
    if (contact.kind === 'emergency-service' && !enrollment.externalEmergencyServices.enabled) {
      blockers.push(`emergency-service-not-opted-in:${contact.id}`);
    }
  }

  const escalationIds = enrollment.escalation.map((step) => step.id);
  if (escalationIds.some((id) => !id.trim())) blockers.push('escalation-id');
  if (new Set(escalationIds).size !== escalationIds.length) blockers.push('duplicate-escalation-id');
  for (const step of enrollment.escalation) {
    if (!Number.isInteger(step.afterSeconds) || step.afterSeconds < 0) {
      blockers.push(`escalation-delay:${step.id}`);
    }
    if (contactsForTiers(enrollment, step.recipientTiers).length === 0) {
      blockers.push(`escalation-recipient:${step.id}`);
    }
    if (step.capability === 'emergency.evidence.release' && enrollment.evidence.releaseMode === 'disabled') {
      blockers.push(`release-disabled:${step.id}`);
    }
  }

  if (!Number.isInteger(enrollment.evidence.rollingBufferSeconds) ||
      enrollment.evidence.rollingBufferSeconds < 0 ||
      enrollment.evidence.rollingBufferSeconds > 600) {
    blockers.push('rolling-buffer');
  }
  if (!Number.isInteger(enrollment.evidence.retentionSeconds) ||
      enrollment.evidence.retentionSeconds < 60 ||
      enrollment.evidence.retentionSeconds > 2_592_000) {
    blockers.push('retention');
  }

  const usesRecording = enrollment.evidence.captureAudio || enrollment.evidence.captureVideo;
  const usesRelease = enrollment.evidence.releaseMode !== 'disabled';
  const usesExternalEmergencyServices = enrollment.externalEmergencyServices.enabled;
  if (usesRecording || usesRelease || usesExternalEmergencyServices) {
    if (!policyReceiptValid(enrollment.jurisdictionPolicy)) blockers.push('jurisdiction-policy');
  }
  if (usesRecording && enrollment.jurisdictionPolicy?.recordingCapture !== 'allowed') {
    blockers.push('recording-policy');
  }
  if (usesRelease && enrollment.jurisdictionPolicy?.evidenceRelease !== 'allowed') {
    blockers.push('evidence-release-policy');
  }
  if (enrollment.evidence.releaseMode === 'critical-preauthorized' && !enrollment.evidence.automaticReleaseOptIn) {
    blockers.push('automatic-release-opt-in');
  }

  if (usesExternalEmergencyServices) {
    if (!enrollment.externalEmergencyServices.providerRef?.trim()) blockers.push('emergency-service-provider');
    if (enrollment.jurisdictionPolicy?.externalEmergencyServices !== 'allowed') {
      blockers.push('emergency-service-policy');
    }
  }

  if (usesRelease &&
      !enabledContacts(enrollment).some((contact) => contact.allowedEvidenceMedia.length > 0)) {
    blockers.push('evidence-release-recipient');
  }

  return [...new Set(blockers)];
}

export function assertConsumerSafetyEnrollment(enrollment: ConsumerSafetyEnrollment): void {
  const blockers = collectConsumerSafetyConfigurationBlockers(enrollment);
  if (blockers.length > 0) throw new Error(`Consumer SafetyOS configuration blocked: ${blockers.join(', ')}`);
}

function assertAuthorizationBinding(
  enrollment: ConsumerSafetyEnrollment,
  step: ConsumerEscalationDraft,
  binding: ConsumerAuthorizationBinding | undefined,
  now: string,
): EmergencyPreAuthorizationReceipt {
  if (!binding) throw new Error(`Missing emergency pre-authorization for escalation: ${step.id}`);
  const receipt = binding.receipt;
  if (receipt.revokedAt) throw new Error(`Emergency pre-authorization revoked: ${receipt.id}`);
  if (receipt.userId !== enrollment.ownerUserId || receipt.protocolId !== enrollment.protocolId) {
    throw new Error(`Emergency pre-authorization scope mismatch: ${receipt.id}`);
  }
  if (!receipt.allowedCapabilities.includes(step.capability)) {
    throw new Error(`Emergency capability not pre-authorized: ${step.capability}`);
  }
  if (receipt.expiresAt && Date.parse(receipt.expiresAt) <= Date.parse(now)) {
    throw new Error(`Emergency pre-authorization expired: ${receipt.id}`);
  }
  const recipients = contactsForTiers(enrollment, step.recipientTiers).map((contact) => contact.id);
  for (const recipientId of recipients) {
    if (!receipt.recipientIds.includes(recipientId)) {
      throw new Error(`Emergency recipient outside pre-authorized scope: ${recipientId}`);
    }
  }
  return receipt;
}

export function compileConsumerPersonalSafetyConfiguration(input: {
  enrollment: ConsumerSafetyEnrollment;
  authorizations: readonly ConsumerAuthorizationBinding[];
  now: string;
}): PersonalSafetyConfiguration {
  assertConsumerSafetyEnrollment(input.enrollment);
  if (!Number.isFinite(Date.parse(input.now))) throw new Error('Invalid compilation time');

  const bindings = new Map(input.authorizations.map((binding) => [binding.escalationId, binding]));
  const rules: SafetyEscalationRule[] = [];
  const receipts: EmergencyPreAuthorizationReceipt[] = [];

  for (const step of input.enrollment.escalation) {
    const receipt = assertAuthorizationBinding(input.enrollment, step, bindings.get(step.id), input.now);
    receipts.push(receipt);
    rules.push({
      id: step.id,
      fromState: step.fromState,
      afterSeconds: step.afterSeconds,
      capability: step.capability,
      recipientIds: contactsForTiers(input.enrollment, step.recipientTiers).map((contact) => contact.id),
      preAuthorizationId: receipt.id,
    });
  }

  const dedupedReceipts = [...new Map(receipts.map((receipt) => [receipt.id, receipt])).values()];
  return {
    profileId: input.enrollment.profileId,
    ownerUserId: input.enrollment.ownerUserId,
    trustedContactIds: enabledContacts(input.enrollment)
      .filter((contact) => contact.kind !== 'emergency-service')
      .map((contact) => contact.id),
    codeWordBindingIds: input.enrollment.activation.codeWordBindingIds,
    defaultCheckInSeconds: input.enrollment.defaultCheckInSeconds,
    escalationRules: rules,
    preAuthorizations: dedupedReceipts,
    gev: {
      enabled: input.enrollment.spatialContext.enabled,
      allowSpatialContext: input.enrollment.spatialContext.enabled,
      allowPublicEnvironmentContext:
        input.enrollment.spatialContext.enabled &&
        input.enrollment.spatialContext.allowPublicEnvironmentContext,
      allowNamedPersonSearch: false,
      allowFaceRecognition: false,
      allowPlateIdentification: false,
    },
    evidence: {
      encryptedAtRest: true,
      requireOffDeviceCopyBeforeRelease: true,
      rollingBufferSeconds: input.enrollment.evidence.rollingBufferSeconds || undefined,
    },
  };
}

export function buildConsumerEvidencePolicy(
  enrollment: ConsumerSafetyEnrollment,
  gate5?: SafetyProdGate5Result,
): EvidencePolicyV2 {
  assertConsumerSafetyEnrollment(enrollment);
  if (enrollment.evidence.releaseMode === 'critical-preauthorized' && !gate5?.admitted) {
    throw new Error('Critical automatic evidence release requires SAFETY-PROD-GATE.5 admission');
  }

  const releaseRecipients = enabledContacts(enrollment)
    .filter((contact) => contact.allowedEvidenceMedia.length > 0)
    .map((contact) => ({
      id: contact.id,
      allowedMedia: contact.allowedEvidenceMedia,
      includeLocation: contact.includeLocation,
    }));

  const release = enrollment.evidence.releaseMode === 'disabled'
    ? {
        enabled: false,
        trigger: 'manual-authorized' as const,
        recipients: [],
        requireUserConfirmation: true,
      }
    : enrollment.evidence.releaseMode === 'manual-confirmed'
      ? {
          enabled: true,
          trigger: 'manual-authorized' as const,
          recipients: releaseRecipients,
          requireUserConfirmation: true,
        }
      : {
          enabled: true,
          trigger: 'critical-escalation' as const,
          recipients: releaseRecipients,
          requireUserConfirmation: false,
        };

  return {
    capture: {
      audio: enrollment.evidence.captureAudio,
      video: enrollment.evidence.captureVideo,
      location: enrollment.evidence.captureLocation,
      rollingBuffer: {
        enabled: enrollment.evidence.rollingBufferSeconds > 0,
        seconds: enrollment.evidence.rollingBufferSeconds,
      },
    },
    retentionSeconds: enrollment.evidence.retentionSeconds,
    release,
  };
}

const threatRank: Readonly<Record<ConsumerThreatLevel, number>> = {
  'check-in': 0,
  elevated: 1,
  critical: 2,
};

export function planConsumerThreatLevel(
  enrollment: ConsumerSafetyEnrollment,
  threat: ConsumerThreatLevel,
): ConsumerThreatPlan {
  assertConsumerSafetyEnrollment(enrollment);
  return {
    threat,
    escalationIds: enrollment.escalation
      .filter((step) => threatRank[threat] >= threatRank[step.minimumThreat])
      .sort((a, b) => a.afterSeconds - b.afterSeconds || a.id.localeCompare(b.id))
      .map((step) => step.id),
    authority: 'PLAN_ONLY',
  };
}

export function buildConsumerPlatformDisclosure(
  capabilities: SafetyPlatformCapabilities,
): ConsumerPlatformDisclosure {
  const featureEntries: readonly [string, boolean][] = [
    ['foreground audio capture', capabilities.foregroundAudio],
    ['foreground video capture', capabilities.foregroundVideo],
    ['background audio capture', capabilities.backgroundAudio],
    ['background video capture', capabilities.backgroundVideo],
    ['background location', capabilities.backgroundLocation],
    ['notifications', capabilities.notifications],
    ['local encrypted storage', capabilities.localEncryptedStorage],
  ];
  const supported = featureEntries.filter(([, available]) => available).map(([name]) => name);
  const unavailable = featureEntries.filter(([, available]) => !available).map(([name]) => name);
  const warnings: string[] = [];
  if (!capabilities.backgroundVideo) {
    warnings.push('Background video is unavailable on this device/runtime; SafetyOS must not represent it as active.');
  }
  if (!capabilities.localEncryptedStorage) {
    warnings.push('Local encrypted storage is unavailable; evidence capture must remain disabled.');
  }
  return { platform: capabilities.platform, supported, unavailable, warnings };
}

export function evaluateConsumerSafetyOSReadiness(input: {
  enrollment: ConsumerSafetyEnrollment;
  setupEvidence: ConsumerSafetySetupEvidence;
  gate5?: SafetyProdGate5Result;
}): ConsumerSafetyReadiness {
  const blockers = [...collectConsumerSafetyConfigurationBlockers(input.enrollment)];
  if (!input.setupEvidence.encryptedProfileRef?.trim()) blockers.push('encrypted-profile');
  if (!input.setupEvidence.deviceCapabilityRef?.trim()) blockers.push('device-capability');

  const needsCommunications = input.enrollment.escalation.some(
    (step) => step.capability === 'emergency.notification.send',
  ) || input.enrollment.externalEmergencyServices.enabled;
  if (needsCommunications && !input.setupEvidence.communicationsProviderRef?.trim()) {
    blockers.push('communications-provider');
  }

  const needsVault =
    input.enrollment.evidence.captureAudio ||
    input.enrollment.evidence.captureVideo ||
    input.enrollment.evidence.captureLocation ||
    input.enrollment.evidence.releaseMode !== 'disabled';
  if (needsVault && !input.setupEvidence.vaultRoundtripRef?.trim()) blockers.push('vault-roundtrip');

  if (input.enrollment.activation.codeWordBindingIds.length > 0 &&
      !input.setupEvidence.codeWordVerifierRef?.trim()) {
    blockers.push('codeword-verifier');
  }

  const setupBlockers = [...new Set(blockers)];
  if (setupBlockers.length > 0) return { stage: 'setup', live: false, blockers: setupBlockers };

  if (!input.setupEvidence.controlledDrillRef?.trim()) {
    return { stage: 'drill-required', live: false, blockers: ['controlled-drill'] };
  }

  if (!input.gate5?.admitted) {
    return {
      stage: 'live-admission-required',
      live: false,
      blockers: input.gate5?.blockers.length ? input.gate5.blockers : ['safety-prod-gate-5'],
    };
  }

  return { stage: 'live-admitted', live: true, blockers: [] };
}

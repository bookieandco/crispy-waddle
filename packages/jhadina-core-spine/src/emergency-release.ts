import type { EvidenceMediaKind } from './emergency-evidence.js';

export interface EvidenceReleasePackage {
  readonly sessionId: string;
  readonly incidentId: string;
  readonly mediaKinds: readonly EvidenceMediaKind[];
  readonly includeLocation: boolean;
  readonly chunkIds: readonly string[];
}

export interface EvidenceDeliveryRecipient {
  readonly id: string;
  readonly channels: readonly ('push' | 'sms' | 'email')[];
}

export interface EvidenceDeliveryResult {
  readonly recipientId: string;
  readonly channel: EvidenceDeliveryRecipient['channels'][number];
  readonly accepted: boolean;
  readonly deliveredAt?: string;
  readonly externalReference?: string;
}

export interface EvidenceReleaseExecutor {
  release(pkg: EvidenceReleasePackage, recipients: readonly EvidenceDeliveryRecipient[]): Promise<readonly EvidenceDeliveryResult[]>;
}

export interface EvidenceReleaseAuthorization {
  readonly sessionId: string;
  readonly incidentId: string;
  readonly trigger: 'critical-escalation' | 'protocol-release' | 'manual-authorized';
  readonly authorizedAt: string;
  readonly recipientIds: readonly string[];
}

/**
 * Release execution accepts only an authorization produced by the deterministic
 * emergency policy. This boundary does not infer danger and does not delegate
 * authorization to an LLM.
 */
export interface AuthorizedEvidenceRelease {
  readonly authorization: EvidenceReleaseAuthorization;
  readonly executor: EvidenceReleaseExecutor;
}

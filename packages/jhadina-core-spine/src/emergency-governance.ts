import type { EvidenceReleaseAuthorization } from './emergency-release.js';

export type EmergencyGovernedCapability =
  | 'emergency.capture.start'
  | 'emergency.evidence.persist'
  | 'emergency.notification.send'
  | 'emergency.evidence.release'
  | 'emergency.incident.resolve';

export interface EmergencyGovernedAction {
  readonly capability: EmergencyGovernedCapability;
  readonly incidentId: string;
  readonly protocolId: string;
  readonly payloadRef?: string;
}

export interface EmergencyActionRequest {
  readonly id: string;
  readonly userId: string;
  readonly type: EmergencyGovernedCapability;
  readonly action: EmergencyGovernedAction;
  readonly requestedAt: string;
  readonly approvalReceiptId?: string;
  readonly emergencyPreAuthorizationId?: string;
}

export interface EmergencyPreAuthorizationReceipt {
  readonly id: string;
  readonly userId: string;
  readonly protocolId: string;
  readonly allowedCapabilities: readonly EmergencyGovernedCapability[];
  readonly recipientIds: readonly string[];
  readonly issuedAt: string;
  readonly expiresAt?: string;
  readonly revokedAt?: string;
}

export function assertEmergencyPreAuthorization(
  receipt: EmergencyPreAuthorizationReceipt,
  request: EmergencyActionRequest,
): void {
  if (receipt.revokedAt) throw new Error('Emergency pre-authorization revoked');
  if (receipt.userId !== request.userId || receipt.protocolId !== request.action.protocolId) {
    throw new Error('Emergency pre-authorization scope mismatch');
  }
  if (!receipt.allowedCapabilities.includes(request.type)) {
    throw new Error('Emergency capability not pre-authorized');
  }
  if (receipt.expiresAt && Date.parse(receipt.expiresAt) <= Date.parse(request.requestedAt)) {
    throw new Error('Emergency pre-authorization expired');
  }
}

export function assertReleaseMatchesPreAuthorization(
  receipt: EmergencyPreAuthorizationReceipt,
  release: EvidenceReleaseAuthorization,
): void {
  if (!receipt.allowedCapabilities.includes('emergency.evidence.release')) {
    throw new Error('Evidence release not pre-authorized');
  }
  for (const recipientId of release.recipientIds) {
    if (!receipt.recipientIds.includes(recipientId)) {
      throw new Error('Evidence recipient outside pre-authorized scope');
    }
  }
}

/**
 * Adapter seam into Jhadina's canonical verified identity -> policy ->
 * ActionExecutor -> durable audit spine. Emergency pre-authorization may
 * replace interactive confirmation only; it never bypasses policy or audit.
 */
export interface EmergencyGovernedExecutor {
  execute(request: EmergencyActionRequest): Promise<unknown>;
}

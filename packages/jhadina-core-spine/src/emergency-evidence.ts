export type EvidenceMediaKind = 'audio' | 'video' | 'location';

export type EvidenceLifecycle =
  | 'armed'
  | 'capturing'
  | 'preserving'
  | 'uploading'
  | 'preserved'
  | 'released'
  | 'expired'
  | 'cancelled';

export interface RollingBufferPolicy {
  readonly enabled: boolean;
  readonly seconds: number;
}

export interface EvidenceCapturePolicy {
  readonly audio: boolean;
  readonly video: boolean;
  readonly location: boolean;
  readonly rollingBuffer: RollingBufferPolicy;
}

export interface EvidenceReleaseRecipient {
  readonly id: string;
  readonly allowedMedia: readonly EvidenceMediaKind[];
  readonly includeLocation: boolean;
}

/**
 * Release is pre-authorized configuration, not an AI decision.
 * A runtime must verify that the incident satisfies the configured trigger
 * before releasing any evidence.
 */
export interface EvidenceReleasePolicy {
  readonly enabled: boolean;
  readonly trigger: 'manual-authorized' | 'critical-escalation' | 'protocol-release';
  readonly recipients: readonly EvidenceReleaseRecipient[];
  readonly requireUserConfirmation: boolean;
}

export interface EvidencePolicyV2 {
  readonly capture: EvidenceCapturePolicy;
  readonly retentionSeconds: number;
  readonly release: EvidenceReleasePolicy;
}

export interface EvidenceSession {
  readonly id: string;
  readonly incidentId: string;
  readonly startedAt: string;
  readonly lifecycle: EvidenceLifecycle;
  readonly policy: EvidencePolicyV2;
}

export interface EvidenceChunk {
  readonly id: string;
  readonly sessionId: string;
  readonly sequence: number;
  readonly mediaKind: EvidenceMediaKind;
  readonly capturedAt: string;
  readonly contentHash: string;
  readonly previousChunkHash?: string;
  readonly persistedOffDevice: boolean;
}

export interface EvidenceRelease {
  readonly id: string;
  readonly sessionId: string;
  readonly authorizedAt: string;
  readonly trigger: EvidenceReleasePolicy['trigger'];
  readonly recipientIds: readonly string[];
}

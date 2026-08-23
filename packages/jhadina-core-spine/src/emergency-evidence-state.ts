import type {
  EvidenceLifecycle,
  EvidenceReleasePolicy,
  EvidenceSession,
} from './emergency-evidence.js';

export type EvidenceStateEvent =
  | 'arm'
  | 'capture-started'
  | 'capture-stopped'
  | 'preserve'
  | 'upload-started'
  | 'persisted-off-device'
  | 'release-authorized'
  | 'expire'
  | 'cancel';

export interface EvidenceStateResult {
  readonly session: EvidenceSession;
  readonly emitted: readonly EvidenceStateEvent[];
}

const transitions: Readonly<Record<EvidenceLifecycle, Partial<Record<EvidenceStateEvent, EvidenceLifecycle>>>> = {
  armed: { 'capture-started': 'capturing', cancel: 'cancelled' },
  capturing: { 'capture-stopped': 'preserving', preserve: 'preserving', cancel: 'cancelled' },
  preserving: { 'upload-started': 'uploading', 'persisted-off-device': 'preserved', cancel: 'cancelled' },
  uploading: { 'persisted-off-device': 'preserved', cancel: 'cancelled' },
  preserved: { 'release-authorized': 'released', expire: 'expired' },
  released: { expire: 'expired' },
  expired: {},
  cancelled: {},
};

export class EvidenceStateMachine {
  constructor(private readonly releasePolicy: EvidenceReleasePolicy) {}

  transition(session: EvidenceSession, event: EvidenceStateEvent): EvidenceStateResult {
    const next = transitions[session.lifecycle][event];
    if (!next) {
      throw new Error(`Invalid evidence transition: ${session.lifecycle} + ${event}`);
    }

    if (event === 'release-authorized') {
      if (!this.releasePolicy.enabled) {
        throw new Error('Evidence release is disabled by policy');
      }
      if (this.releasePolicy.requireUserConfirmation) {
        throw new Error('Evidence release requires user confirmation');
      }
    }

    return {
      session: { ...session, lifecycle: next },
      emitted: [event],
    };
  }
}

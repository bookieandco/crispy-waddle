import type { SecurityPosture } from './security-posture.js';

export type KillSwitchState = {
  enabled: boolean;
  changedAt: number;
  reason: string;
  actorId: string;
  version: number;
};

export type KillSwitchStore = {
  read(): Promise<KillSwitchState>;
  write(next: KillSwitchState, expectedVersion: number): Promise<void>;
};

export type KillSwitchDecision = {
  allowed: boolean;
  reason: 'kill_switch_enabled' | 'lockdown' | 'allowed';
  version: number;
};

export class InMemoryKillSwitchStore implements KillSwitchStore {
  private state: KillSwitchState = {
    enabled: false,
    changedAt: 0,
    reason: 'initial',
    actorId: 'system',
    version: 0,
  };

  async read(): Promise<KillSwitchState> {
    return { ...this.state };
  }

  async write(next: KillSwitchState, expectedVersion: number): Promise<void> {
    if (this.state.version !== expectedVersion) throw new Error('kill_switch_version_conflict');
    if (next.version !== expectedVersion + 1) throw new Error('kill_switch_version_invalid');
    this.state = { ...next };
  }
}

export class SecurityKillSwitch {
  constructor(private readonly store: KillSwitchStore) {}

  async enable(actorId: string, reason: string, now = Date.now()): Promise<KillSwitchState> {
    if (!actorId || !reason.trim()) throw new Error('kill_switch_identity_or_reason_required');
    const current = await this.store.read();
    const next: KillSwitchState = {
      enabled: true,
      changedAt: now,
      reason: reason.trim().slice(0, 500),
      actorId,
      version: current.version + 1,
    };
    await this.store.write(next, current.version);
    return next;
  }

  async disable(actorId: string, reason: string, now = Date.now()): Promise<KillSwitchState> {
    if (!actorId || !reason.trim()) throw new Error('kill_switch_identity_or_reason_required');
    const current = await this.store.read();
    const next: KillSwitchState = {
      enabled: false,
      changedAt: now,
      reason: reason.trim().slice(0, 500),
      actorId,
      version: current.version + 1,
    };
    await this.store.write(next, current.version);
    return next;
  }

  async decide(posture: SecurityPosture, capability: string): Promise<KillSwitchDecision> {
    const state = await this.store.read();
    if (state.enabled) return { allowed: false, reason: 'kill_switch_enabled', version: state.version };
    if (posture === 'lockdown' && capability !== 'security.recover' && !capability.startsWith('read.')) {
      return { allowed: false, reason: 'lockdown', version: state.version };
    }
    return { allowed: true, reason: 'allowed', version: state.version };
  }
}

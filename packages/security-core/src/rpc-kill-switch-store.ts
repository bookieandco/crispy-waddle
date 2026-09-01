import type { KillSwitchState, KillSwitchStore } from './security-kill-switch.js';

export interface KillSwitchRpcClient {
  rpc<T = unknown>(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: T | null; error: { message: string } | null }>;
}

type KillSwitchRow = {
  enabled: boolean;
  changed_at: string;
  reason: string;
  actor_id: string | null;
  version: number | string;
};

function toState(row: KillSwitchRow): KillSwitchState {
  if (!row || typeof row.enabled !== 'boolean' || typeof row.changed_at !== 'string' || typeof row.reason !== 'string') {
    throw new Error('KILL_SWITCH_STATE_INVALID');
  }
  if (row.actor_id === null || typeof row.actor_id !== 'string' || !row.actor_id) {
    if (Number(row.version) !== 0) throw new Error('KILL_SWITCH_STATE_INVALID');
  }
  const version = Number(row.version);
  const changedAt = Date.parse(row.changed_at);
  if (!Number.isSafeInteger(version) || version < 0 || !Number.isFinite(changedAt)) {
    throw new Error('KILL_SWITCH_STATE_INVALID');
  }
  return {
    enabled: row.enabled,
    changedAt,
    reason: row.reason,
    actorId: row.actor_id ?? 'system',
    version,
  };
}

export class RpcKillSwitchStore implements KillSwitchStore {
  constructor(private readonly client: KillSwitchRpcClient) {}

  async read(): Promise<KillSwitchState> {
    const { data, error } = await this.client.rpc<KillSwitchRow[]>('read_jhadina_security_kill_switch', {});
    if (error || !Array.isArray(data) || data.length !== 1) throw new Error('KILL_SWITCH_STATE_UNAVAILABLE');
    return toState(data[0]);
  }

  async write(next: KillSwitchState, expectedVersion: number): Promise<void> {
    const { data, error } = await this.client.rpc<KillSwitchRow[]>('transition_jhadina_security_kill_switch', {
      p_enabled: next.enabled,
      p_reason: next.reason,
      p_expected_version: expectedVersion,
    });
    if (error) throw new Error(error.message === 'KILL_SWITCH_VERSION_CONFLICT' ? 'kill_switch_version_conflict' : 'KILL_SWITCH_WRITE_FAILED');
    if (!Array.isArray(data) || data.length !== 1) throw new Error('KILL_SWITCH_WRITE_FAILED');
    const persisted = toState(data[0]);
    if (persisted.version !== next.version || persisted.enabled !== next.enabled) {
      throw new Error('KILL_SWITCH_WRITE_VERIFICATION_FAILED');
    }
  }
}

import { describe, expect, it } from 'vitest';
import { CredentialBroker, CredentialBrokerError, InMemoryCredentialStore } from './credential-broker.js';
import { RpcKillSwitchStore } from './rpc-kill-switch-store.js';
import { InMemoryKillSwitchStore, SecurityKillSwitch } from './security-kill-switch.js';

const row = (enabled: boolean, version: number) => [{ enabled, changed_at: new Date(1_000 + version).toISOString(), reason: enabled ? 'test' : 'initial', actor_id: enabled ? 'actor-1' : null, version }];

describe('RpcKillSwitchStore', () => {
  it('reads the singleton state and writes with an expected version', async () => {
    let version = 0;
    let enabled = false;
    const calls: string[] = [];
    const store = new RpcKillSwitchStore({
      async rpc<T>(fn: string, args: Record<string, unknown>) {
        calls.push(fn);
        if (fn === 'read_jhadina_security_kill_switch') return { data: row(enabled, version) as T, error: null };
        if (args.p_expected_version !== version) return { data: null, error: { message: 'KILL_SWITCH_VERSION_CONFLICT' } };
        enabled = Boolean(args.p_enabled);
        version += 1;
        return { data: row(enabled, version) as T, error: null };
      },
    });
    expect((await store.read()).version).toBe(0);
    await store.write({ enabled: true, changedAt: 0, reason: 'test', actorId: 'actor-1', version: 1 }, 0);
    expect((await store.read()).enabled).toBe(true);
    expect(calls).toEqual(['read_jhadina_security_kill_switch', 'transition_jhadina_security_kill_switch', 'read_jhadina_security_kill_switch']);
  });

  it('maps a stale writer to a version conflict', async () => {
    const store = new RpcKillSwitchStore({
      async rpc<T>(fn: string) {
        if (fn === 'read_jhadina_security_kill_switch') return { data: row(false, 4) as T, error: null };
        return { data: null, error: { message: 'KILL_SWITCH_VERSION_CONFLICT' } };
      },
    });
    await expect(store.write({ enabled: true, changedAt: 0, reason: 'x', actorId: 'a', version: 5 }, 3)).rejects.toThrow('kill_switch_version_conflict');
  });
});

describe('credential broker kill-switch fail-closed behavior', () => {
  const request = {
    requestId: 'r1', actorId: 'a1', workerId: 'w1' as const, workerTrust: 'trusted-compute' as const,
    capability: 'money.account.read', provider: 'plaid', credentialRef: 'money/plaid/default', purpose: 'test',
    issuedAt: 1_000, expiresAt: 20_000, nonce: 'n1',
  };

  it('denies issuance when durable kill-switch state cannot be read', async () => {
    const killSwitch = new SecurityKillSwitch({
      async read() { throw new Error('database unavailable'); },
      async write() { throw new Error('database unavailable'); },
    });
    const broker = new CredentialBroker(new InMemoryCredentialStore({ 'money/plaid/default': { secret: 'never-returned-on-failure' } }), {
      maxTtlMs: 60_000,
      providerCapabilities: { plaid: ['money.account.read'] },
      allowedCredentialRefs: ['money/plaid/default'],
      maxUses: 1,
    }, () => 1_000, () => 'lease-1', undefined, { killSwitch, posture: 'normal' });
    await expect(broker.issue(request)).rejects.toMatchObject({ code: 'KILL_SWITCH_STATE_UNAVAILABLE' } satisfies Partial<CredentialBrokerError>);
  });

  it('blocks issuance when the durable kill switch is enabled', async () => {
    const store = new InMemoryKillSwitchStore();
    const killSwitch = new SecurityKillSwitch(store);
    await killSwitch.enable('actor-1', 'incident', 1_000);
    const broker = new CredentialBroker(new InMemoryCredentialStore({ 'money/plaid/default': { secret: 'blocked' } }), {
      maxTtlMs: 60_000,
      providerCapabilities: { plaid: ['money.account.read'] },
      allowedCredentialRefs: ['money/plaid/default'],
      maxUses: 1,
    }, () => 1_000, () => 'lease-1', undefined, { killSwitch, posture: 'normal' });
    await expect(broker.issue(request)).rejects.toMatchObject({ code: 'KILL_SWITCH_ENABLED' });
  });
});

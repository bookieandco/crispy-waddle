import { describe, expect, it } from 'vitest';
import { InMemoryKillSwitchStore, SecurityKillSwitch } from './security-kill-switch.js';

describe('SecurityKillSwitch', () => {
  it('denies consequential capabilities while enabled', async () => {
    const kill = new SecurityKillSwitch(new InMemoryKillSwitchStore());
    await kill.enable('owner', 'suspected compromise', 1000);
    await expect(kill.decide('normal', 'financial.execute')).resolves.toEqual({
      allowed: false,
      reason: 'kill_switch_enabled',
      version: 1,
    });
  });

  it('allows read capabilities during lockdown', async () => {
    const kill = new SecurityKillSwitch(new InMemoryKillSwitchStore());
    await expect(kill.decide('lockdown', 'read.memory')).resolves.toMatchObject({ allowed: true });
  });

  it('requires a reason and actor for state changes', async () => {
    const kill = new SecurityKillSwitch(new InMemoryKillSwitchStore());
    await expect(kill.enable('', 'reason')).rejects.toThrow('kill_switch_identity_or_reason_required');
    await expect(kill.enable('owner', '  ')).rejects.toThrow('kill_switch_identity_or_reason_required');
  });

  it('prevents stale concurrent writers from overwriting state', async () => {
    const store = new InMemoryKillSwitchStore();
    const kill = new SecurityKillSwitch(store);
    await kill.enable('owner', 'incident');
    const stale = { enabled: false, changedAt: 2, reason: 'stale', actorId: 'attacker', version: 2 };
    await expect(store.write(stale, 0)).rejects.toThrow('kill_switch_version_conflict');
  });

  it('requires explicit recovery capability during lockdown', async () => {
    const kill = new SecurityKillSwitch(new InMemoryKillSwitchStore());
    await expect(kill.decide('lockdown', 'financial.execute')).resolves.toMatchObject({ allowed: false, reason: 'lockdown' });
    await expect(kill.decide('lockdown', 'security.recover')).resolves.toMatchObject({ allowed: true });
  });
});

import { describe, expect, it } from 'vitest';
import {
  InMemoryNonceReplayGuard,
  JhadinaSecurityCore,
  JHADINA_BASE_SECURITY_POLICY,
  createSecurityRequest,
} from './index.js';

describe('durable-capable nonce replay boundary', () => {
  it('accepts a nonce once and rejects the same nonce on replay', async () => {
    const guard = new InMemoryNonceReplayGuard();
    const request = createSecurityRequest({
      requestId: 'action-1',
      actorId: 'user-1',
      domain: 'money',
      capability: 'money.account.read',
    });

    expect(await guard.consume(request)).toBe(true);
    expect(await guard.consume(request)).toBe(false);
  });

  it('rejects expired requests before claiming the nonce', async () => {
    const guard = new InMemoryNonceReplayGuard();
    const request = {
      ...createSecurityRequest({
        requestId: 'action-expired',
        actorId: 'user-1',
        domain: 'money',
        capability: 'money.account.read',
      }),
      expiresAt: Date.now() - 1,
    };

    expect(await guard.consume(request)).toBe(false);
  });

  it('uses the durable guard when supplied to Security Core', async () => {
    const guard = new InMemoryNonceReplayGuard();
    const security = new JhadinaSecurityCore(JHADINA_BASE_SECURITY_POLICY);
    const request = createSecurityRequest({
      requestId: 'action-2',
      actorId: 'user-1',
      domain: 'jhadina',
      capability: 'memory.read',
    });

    expect(await security.authorizeWithReplayGuard(request, guard)).toBe('allow');
    expect(await security.authorizeWithReplayGuard(request, guard)).toBe('deny');
  });

  it('keeps replay ownership separate from actor policy decisions', async () => {
    const guard = new InMemoryNonceReplayGuard();
    const security = new JhadinaSecurityCore(JHADINA_BASE_SECURITY_POLICY);
    const first = createSecurityRequest({
      requestId: 'action-3',
      actorId: 'user-1',
      domain: 'jhadina',
      capability: 'memory.read',
    });
    const crossActor = { ...first, actorId: 'user-2' };

    expect(await security.authorizeWithReplayGuard(first, guard)).toBe('allow');
    expect(await security.authorizeWithReplayGuard(crossActor, guard)).toBe('deny');
  });
});

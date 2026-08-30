import { describe, expect, it } from 'vitest';
import { CommandSecurityGateway } from './command-security-gateway.js';
import type { SecurityPrincipal } from './security-principal.js';

const now = Date.now();
const principal: SecurityPrincipal = {
  principalId: 'principal-owner-1',
  type: 'owner',
  subjectId: 'owner-1',
  deviceId: 'device-1',
  sessionId: 'session-1',
  authenticatedAt: now - 1000,
  expiresAt: now + 60_000,
  authenticationMethod: 'passkey',
};

const base = {
  requestId: 'request-1', actorId: 'owner-1', domain: 'jhadina',
  capability: 'research.run', payload: { query: 'safe' },
  nonce: 'nonce-1', expiresAt: now + 30_000, principal,
};

describe('CommandSecurityGateway', () => {
  it('allows an authenticated allowlisted low-risk command', () => {
    expect(new CommandSecurityGateway('normal').authorize(base).decision).toBe('allow');
  });

  it('requires approval for consequential capabilities', () => {
    expect(new CommandSecurityGateway('normal').authorize({ ...base, capability: 'public.publish' }).decision).toBe('approval_required');
  });

  it('rejects actor impersonation', () => {
    expect(new CommandSecurityGateway('normal').authorize({ ...base, actorId: 'attacker' }).decision).toBe('deny');
  });

  it('rejects capabilities blocked by posture', () => {
    expect(new CommandSecurityGateway('restricted').authorize({ ...base, capability: 'financial.execute' }).decision).toBe('deny');
  });

  it('rejects unknown capabilities', () => {
    expect(new CommandSecurityGateway('normal').authorize({ ...base, capability: 'admin.root' }).decision).toBe('deny');
  });
});

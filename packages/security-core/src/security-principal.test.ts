import { describe, expect, it } from 'vitest';
import { bindPrincipalToRequest, isPrincipalFresh, type SecurityPrincipal } from './security-principal.js';

const now = 1_000_000;
const principal: SecurityPrincipal = {
  principalId: 'principal-owner-1',
  type: 'owner',
  subjectId: 'owner-1',
  deviceId: 'device-1',
  sessionId: 'session-1',
  authenticatedAt: now - 1000,
  expiresAt: now + 30_000,
  authenticationMethod: 'passkey',
};

describe('security principal', () => {
  it('accepts a fresh authenticated principal', () => {
    expect(isPrincipalFresh(principal, now)).toBe(true);
  });

  it('rejects expired principals', () => {
    expect(isPrincipalFresh({ ...principal, expiresAt: now }, now)).toBe(false);
  });

  it('requires actor, device and session binding', () => {
    expect(bindPrincipalToRequest(principal, {
      actorId: 'owner-1', principalId: 'principal-owner-1', deviceId: 'device-1', sessionId: 'session-1', expiresAt: now + 10_000,
    }, now)).toBe(true);

    expect(bindPrincipalToRequest(principal, {
      actorId: 'attacker', principalId: 'principal-owner-1', deviceId: 'device-1', sessionId: 'session-1', expiresAt: now + 10_000,
    }, now)).toBe(false);

    expect(bindPrincipalToRequest(principal, {
      actorId: 'owner-1', principalId: 'principal-owner-1', deviceId: 'attacker-device', sessionId: 'session-1', expiresAt: now + 10_000,
    }, now)).toBe(false);
  });
});

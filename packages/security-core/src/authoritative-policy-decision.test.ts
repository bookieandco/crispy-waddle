import { describe, expect, it } from 'vitest';
import { createAuthoritativePolicyDecision, verifyAuthoritativePolicyDecision } from './authoritative-policy-decision.js';

const request = { requestId: 'req-1', actorId: 'actor-1', domain: 'money', capability: 'money.account.read', resourceId: 'account-1' };

function decision(overrides: Partial<Parameters<typeof createAuthoritativePolicyDecision>[0]> = {}) {
  return createAuthoritativePolicyDecision({ ...request, decision: 'allow', policyVersion: 'policy-v1', decidedAt: 1_000, expiresAt: 10_000, ...overrides });
}

describe('authoritative policy decision', () => {
  it('binds the decision to the exact request', () => {
    expect(verifyAuthoritativePolicyDecision(decision(), request, 2_000)).toBe(true);
    expect(verifyAuthoritativePolicyDecision(decision(), { ...request, actorId: 'other' }, 2_000)).toBe(false);
    expect(verifyAuthoritativePolicyDecision(decision(), { ...request, capability: 'financial.execute' }, 2_000)).toBe(false);
    expect(verifyAuthoritativePolicyDecision(decision(), { ...request, resourceId: 'other' }, 2_000)).toBe(false);
  });

  it('rejects expired or future decisions', () => {
    expect(verifyAuthoritativePolicyDecision(decision(), request, 10_000)).toBe(false);
    expect(verifyAuthoritativePolicyDecision(decision({ decidedAt: 5_000, expiresAt: 10_000 }), request, 2_000)).toBe(false);
  });

  it('rejects malformed decisions', () => {
    expect(() => createAuthoritativePolicyDecision({ ...request, decision: 'allow', policyVersion: '', decidedAt: 1_000, expiresAt: 10_000 })).toThrow('POLICY_DECISION_BINDING_REQUIRED');
  });
});

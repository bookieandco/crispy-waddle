import { describe, expect, it } from 'vitest';
import { JhadinaPolicyEngine } from './policy-engine.js';

describe('JhadinaPolicyEngine', () => {
  const request = () => ({
    requestId: 'req-1',
    actorId: 'actor-1',
    domain: 'research',
    capability: 'research.run',
    resourceId: 'job-1',
    issuedAt: 1_000,
    expiresAt: 10_000,
  });

  it('issues an allow decision from objective request facts', () => {
    const decision = new JhadinaPolicyEngine().decide(request());
    expect(decision.decision).toBe('allow');
    expect(decision.requestId).toBe('req-1');
    expect(decision.actorId).toBe('actor-1');
    expect(decision.domain).toBe('research');
    expect(decision.capability).toBe('research.run');
    expect(decision.resourceId).toBe('job-1');
    expect(decision.policyVersion).toBe('values-v1');
    expect(decision.decidedAt).toBe(1_000);
    expect(decision.expiresAt).toBe(10_000);
    expect(decision.decisionId).toBeTruthy();
  });

  it('fails closed for an unclassified capability', () => {
    const decision = new JhadinaPolicyEngine().decide({ ...request(), capability: 'unknown.capability' });
    expect(decision.decision).toBe('deny');
  });

  it('uses risk facts rather than a caller-supplied decision', () => {
    const engine = new JhadinaPolicyEngine({
      version: 7,
      updatedAt: '2026-09-01T00:00:00.000Z',
      updatedBy: 'user_real_human',
      financial: { maxAmountMinorPerAction: 100, maxAmountMinorPerDay: 100 },
      externalCommunication: { allowedRecipientDomains: ['example.com'], deniedRecipients: [] },
      publishing: { allowedPlatforms: ['example'], },
      selfModification: { allowEvolutionProposals: true },
    });
    const decision = engine.decide({ ...request(), capability: 'financial.execute', amountMinor: 101 });
    expect(decision.decision).toBe('deny');
    expect(decision.policyVersion).toBe('values-v7');
  });
});

import { describe, expect, it } from 'vitest';
import { JhadinaPolicyEngine } from './policy-engine.js';
import type { JhadinaValuesConfiguration } from './values-configuration.js';

const values = (overrides: Partial<JhadinaValuesConfiguration> = {}): JhadinaValuesConfiguration => ({
  version: 1,
  updatedAt: '2026-09-01T00:00:00.000Z',
  updatedBy: 'user_real_human',
  financial: { currency: 'USD', maxAmountMinorPerAction: 0, maxAmountMinorPerDay: 0 },
  externalCommunication: { allowedRecipientDomains: [], deniedRecipients: [] },
  publishing: { allowedPlatforms: [] },
  selfModification: { allowEvolutionProposals: true },
  ...overrides,
});

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
    const decision = new JhadinaPolicyEngine(values()).decide(request());
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
    const decision = new JhadinaPolicyEngine(values()).decide({ ...request(), capability: 'unknown.capability' });
    expect(decision.decision).toBe('deny');
  });

  it('requires approval for an allowed financial capability within the values limit', () => {
    const engine = new JhadinaPolicyEngine(values({
      financial: { currency: 'USD', maxAmountMinorPerAction: 100, maxAmountMinorPerDay: 100 },
    }));
    const decision = engine.decide({ ...request(), capability: 'financial.execute', amountMinor: 50 });
    expect(decision.decision).toBe('approval_required');
  });

  it('denies a financial request over the values limit', () => {
    const engine = new JhadinaPolicyEngine(values({
      version: 7,
      financial: { currency: 'USD', maxAmountMinorPerAction: 100, maxAmountMinorPerDay: 100 },
    }));
    const decision = engine.decide({ ...request(), capability: 'financial.execute', amountMinor: 101 });
    expect(decision.decision).toBe('deny');
    expect(decision.policyVersion).toBe('values-v7');
  });

  it('cannot be loosened by an allowed capability when risk requires approval', () => {
    const engine = new JhadinaPolicyEngine(values({
      financial: { currency: 'USD', maxAmountMinorPerAction: 100, maxAmountMinorPerDay: 100 },
    }), {
      allowedCapabilities: ['financial.execute'],
      approvalCapabilities: [],
    });
    const decision = engine.decide({ ...request(), capability: 'financial.execute', amountMinor: 50 });
    expect(decision.decision).toBe('approval_required');
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { ActionRequest, DecisionProposal, PolicyDecision } from './types.js';
import { GovernedActionGateway } from './action-gateway.js';

const proposal: DecisionProposal = {
  id: 'proposal-1',
  contextId: 'context-1',
  disposition: 'PROCEED',
  recommendation: 'Turn on the lamp',
  rationale: 'User requested it',
  evidence: [],
  uncertainty: [],
  alternatives: [],
};

const policy: PolicyDecision = {
  id: 'policy-1',
  proposalId: 'proposal-1',
  allowed: true,
  reason: 'allowed',
  requiredApproval: false,
  evaluatedAt: '2026-08-31T00:00:00.000Z',
};

const request: ActionRequest = {
  id: 'action-1',
  proposalId: 'proposal-1',
  capability: 'home.light.turn_on',
  operation: 'turn_on',
  input: { entityId: 'ha:entity:light.lamp' },
  reversible: true,
  consequenceLevel: 'low',
};

describe('GovernedActionGateway', () => {
  it('does not prepare denied or approval-required actions', async () => {
    const planner = { prepare: vi.fn(async () => request) };
    const gateway = new GovernedActionGateway(planner, new Map([['home.light.turn_on', { execute: vi.fn() }]]));

    expect(await gateway.prepare(proposal, { ...policy, allowed: false })).toBeUndefined();
    expect(await gateway.prepare(proposal, { ...policy, requiredApproval: true })).toBeUndefined();
    expect(planner.prepare).not.toHaveBeenCalled();
  });

  it('rejects a planner request tied to another proposal', async () => {
    const planner = { prepare: vi.fn(async () => ({ ...request, proposalId: 'other-proposal' })) };
    const gateway = new GovernedActionGateway(planner, new Map([['home.light.turn_on', { execute: vi.fn() }]]));

    expect(await gateway.prepare(proposal, policy)).toBeUndefined();
  });

  it('requires a registered capability executor before preparing', async () => {
    const planner = { prepare: vi.fn(async () => request) };
    const gateway = new GovernedActionGateway(planner, new Map());

    expect(await gateway.prepare(proposal, policy)).toBeUndefined();
  });

  it('dispatches execution only through the capability executor', async () => {
    const execute = vi.fn(async (input: ActionRequest) => ({
      id: 'result-1',
      requestId: input.id,
      success: true,
      completedAt: '2026-08-31T00:00:01.000Z',
    }));
    const gateway = new GovernedActionGateway(
      { prepare: vi.fn(async () => request) },
      new Map([['home.light.turn_on', { execute }]]),
    );

    const prepared = await gateway.prepare(proposal, policy);
    expect(prepared).toEqual(request);
    await expect(gateway.execute(request)).resolves.toMatchObject({ success: true, requestId: 'action-1' });
    expect(execute).toHaveBeenCalledWith(request);
  });

  it('returns a deterministic failure for an unregistered capability', async () => {
    const gateway = new GovernedActionGateway({ prepare: vi.fn() }, new Map());

    await expect(gateway.execute(request)).resolves.toMatchObject({
      success: false,
      requestId: 'action-1',
      error: 'no executor registered for capability: home.light.turn_on',
    });
  });
});

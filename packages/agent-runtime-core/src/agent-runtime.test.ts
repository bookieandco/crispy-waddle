import { describe, expect, it, vi } from 'vitest';
import {
  DurableAgentRuntime,
  InMemoryAgentRuntimeRepository,
  type AgentPlan,
} from './agent-runtime';

function ids() {
  let n = 0;
  return { next: (prefix: string) => `${prefix}-${++n}` };
}

const planFactory = async ({ run, revision, previousPlan, reason }: Parameters<NonNullable<ConstructorParameters<typeof DurableAgentRuntime>[3]>>[0]): Promise<AgentPlan> => ({
  id: `plan-${revision}`,
  runId: run.id,
  revision,
  objective: run.objective,
  rationale: reason === 'replan' ? 'Recovery required a new plan.' : 'Initial plan.',
  supersedesPlanId: previousPlan?.id,
  createdAt: '2026-09-01T00:00:00.000Z',
  steps: [{
    id: `step-${revision}-1`,
    ordinal: 1,
    capability: 'calendar.read',
    operation: 'read',
    input: { date: '2026-09-01' },
    consequenceLevel: 'low',
  }],
});

describe('DurableAgentRuntime', () => {
  it('persists run, plan, policy, step, and checkpoint through plan/execute', async () => {
    const repository = new InMemoryAgentRuntimeRepository();
    const executor = { execute: vi.fn().mockResolvedValue({ events: 2 }) };
    const runtime = new DurableAgentRuntime(
      repository,
      { evaluate: vi.fn(async () => ({ id: 'policy-1', runId: 'agent-run-1', allowed: true, requiredApproval: false, reason: 'allowed', evaluatedAt: '2026-09-01T00:00:00.000Z' })) },
      executor,
      planFactory,
      ids(),
      () => '2026-09-01T00:00:00.000Z',
    );

    const run = await runtime.createRun('Read my calendar');
    const plan = await runtime.plan(run.id);
    const step = await runtime.executeNext(run.id);

    expect(plan.revision).toBe(1);
    expect(step.status).toBe('completed');
    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect((await repository.getLatestCheckpoint(run.id))?.reason).toBe('step-completed');
  });

  it('fails closed at policy and never executes a denied step', async () => {
    const repository = new InMemoryAgentRuntimeRepository();
    const executor = { execute: vi.fn() };
    const runtime = new DurableAgentRuntime(
      repository,
      { evaluate: vi.fn(async () => ({ id: 'policy-deny', runId: 'agent-run-1', allowed: false, requiredApproval: false, reason: 'Capability denied', evaluatedAt: '2026-09-01T00:00:00.000Z' })) },
      executor,
      planFactory,
      ids(),
      () => '2026-09-01T00:00:00.000Z',
    );

    const run = await runtime.createRun('Denied action');
    await runtime.plan(run.id);
    const step = await runtime.executeNext(run.id);

    expect(step.status).toBe('failed');
    expect(step.error).toBe('Capability denied');
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('creates a new plan revision instead of mutating the prior plan', async () => {
    const repository = new InMemoryAgentRuntimeRepository();
    const runtime = new DurableAgentRuntime(
      repository,
      { evaluate: vi.fn(async () => ({ id: 'policy', runId: 'agent-run-1', allowed: true, requiredApproval: false, reason: 'allowed', evaluatedAt: '2026-09-01T00:00:00.000Z' })) },
      { execute: vi.fn() },
      planFactory,
      ids(),
      () => '2026-09-01T00:00:00.000Z',
    );

    const run = await runtime.createRun('Replan me');
    const first = await runtime.plan(run.id);
    const second = await runtime.replan(run.id);

    expect(second.revision).toBe(2);
    expect(second.supersedesPlanId).toBe(first.id);
    expect((await repository.getLatestPlan(run.id))?.id).toBe(second.id);
  });
});

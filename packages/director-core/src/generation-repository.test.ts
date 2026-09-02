import { describe, expect, it } from 'vitest';
import type { GenerationExecution } from './generation-execution';
import type { GenerationTask } from './generation-task';
import { InMemoryGenerationRepository } from './generation-repository';

function task(overrides: Partial<GenerationTask> = {}): GenerationTask {
  return {
    id: 'task-1',
    projectId: 'project-1',
    request: {
      requestId: 'task-1',
      projectId: 'project-1',
      modality: 'image',
      prompt: 'test',
      model: { id: 'model-1', providerId: 'provider-1' },
      parameters: {},
    },
    idempotencyKey: 'idem-1',
    status: 'queued',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function execution(overrides: Partial<GenerationExecution> = {}): GenerationExecution {
  return {
    id: 'task-1:attempt:1',
    taskId: 'task-1',
    providerId: 'provider-1',
    providerJobId: 'provider-job-1',
    attempt: 1,
    status: 'queued',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('GenerationRepository', () => {
  it('persists and returns cloned task state', async () => {
    const repository = new InMemoryGenerationRepository();
    const original = task();
    await repository.saveTask(original);
    const loaded = await repository.getTask(original.id);
    expect(loaded).toEqual(original);
    expect(loaded).not.toBe(original);
    original.request.prompt = 'mutated';
    expect((await repository.getTask(original.id))?.request.prompt).toBe('test');
  });

  it('rejects an idempotency key collision across task identities', async () => {
    const repository = new InMemoryGenerationRepository();
    await repository.saveTask(task());
    await expect(repository.saveTask(task({
      id: 'task-2',
      request: { ...task().request, requestId: 'task-2' },
    }))).rejects.toThrow('idempotency key already belongs to task: task-1');
  });

  it('finds tasks by idempotency key', async () => {
    const repository = new InMemoryGenerationRepository();
    await repository.saveTask(task());
    await expect(repository.getTaskByIdempotencyKey('idem-1')).resolves.toEqual(task());
    await expect(repository.getTaskByIdempotencyKey('missing')).resolves.toBeUndefined();
  });

  it('looks up provider executions and sorts attempts', async () => {
    const repository = new InMemoryGenerationRepository();
    await repository.saveExecution(execution({ id: 'task-1:attempt:2', attempt: 2, providerJobId: 'provider-job-2', status: 'running' }));
    await repository.saveExecution(execution());
    await expect(repository.getExecutionByProviderJob('provider-1', 'provider-job-2')).resolves.toMatchObject({ attempt: 2 });
    await expect(repository.listExecutions('task-1')).resolves.toEqual([
      expect.objectContaining({ attempt: 1 }),
      expect.objectContaining({ attempt: 2 }),
    ]);
  });

  it('rejects a stale worker from overwriting a replacement worker lease', async () => {
    const repository = new InMemoryGenerationRepository();
    const first = await repository.claimExecution('task-1', 'provider-1', 'worker-a', 1);
    expect(first?.leaseOwner).toBe('worker-a');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const replacement = await repository.claimExecution('task-1', 'provider-1', 'worker-b', 30_000);
    expect(replacement?.leaseOwner).toBe('worker-b');

    const staleWrite = await repository.saveExecution({
      ...first!,
      providerJobId: 'stale-provider-job',
      status: 'queued',
      leaseOwner: 'worker-a',
      updatedAt: new Date().toISOString(),
    });

    expect(staleWrite).toBe(false);
    await expect(repository.getExecution(first!.id)).resolves.toMatchObject({
      leaseOwner: 'worker-b',
      providerJobId: undefined,
    });
  });

  it('persists task and execution atomically as one fenced transition', async () => {
    const repository = new InMemoryGenerationRepository();
    const originalTask = task();
    await repository.claimTask(originalTask);
    const leased = await repository.claimExecution(originalTask.id, 'provider-1', 'worker-a', 30_000);
    expect(leased?.leaseToken).toBeDefined();

    const updatedTask = { ...originalTask, status: 'running' as const, updatedAt: '2026-09-01T00:00:01.000Z' };
    const updatedExecution = { ...leased!, status: 'running' as const, updatedAt: '2026-09-01T00:00:01.000Z' };
    await expect(repository.saveState(updatedTask, updatedExecution)).resolves.toBe(true);
    await expect(repository.getTask(originalTask.id)).resolves.toMatchObject({ status: 'running', updatedAt: '2026-09-01T00:00:01.000Z' });
    await expect(repository.getExecution(leased!.id)).resolves.toMatchObject({ status: 'running', leaseOwner: 'worker-a' });
  });

  it('rejects a stale atomic transition without changing either durable record', async () => {
    const repository = new InMemoryGenerationRepository();
    const originalTask = task();
    await repository.claimTask(originalTask);
    const first = await repository.claimExecution(originalTask.id, 'provider-1', 'worker-a', 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const replacement = await repository.claimExecution(originalTask.id, 'provider-1', 'worker-b', 30_000);
    expect(replacement?.leaseToken).not.toBe(first?.leaseToken);

    const staleTask = { ...originalTask, status: 'completed' as const, error: undefined, updatedAt: '2026-09-01T00:00:02.000Z' };
    const staleExecution = { ...first!, status: 'completed' as const, providerJobId: 'stale-provider-job', updatedAt: '2026-09-01T00:00:02.000Z' };
    await expect(repository.saveState(staleTask, staleExecution)).resolves.toBe(false);

    await expect(repository.getTask(originalTask.id)).resolves.toEqual(originalTask);
    await expect(repository.getExecution(first!.id)).resolves.toMatchObject({ leaseOwner: 'worker-b', providerJobId: undefined, status: 'queued' });
  });
});

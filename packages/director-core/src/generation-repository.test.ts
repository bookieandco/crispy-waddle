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
    await repository.saveExecution(execution({
      id: 'task-1:attempt:2',
      attempt: 2,
      providerJobId: 'provider-job-2',
      status: 'running',
    }));
    await repository.saveExecution(execution());

    await expect(repository.getExecutionByProviderJob('provider-1', 'provider-job-2'))
      .resolves.toMatchObject({ attempt: 2 });
    await expect(repository.listExecutions('task-1'))
      .resolves.toEqual([
        expect.objectContaining({ attempt: 1 }),
        expect.objectContaining({ attempt: 2 }),
      ]);
  });
});

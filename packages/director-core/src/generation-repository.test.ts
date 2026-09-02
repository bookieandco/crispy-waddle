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
    await expect(repository.saveTask(task({ id: 'task-2', request: { ...task().request, requestId: 'task-2' } }))).rejects.toThrow('idempotency key already belongs to task: task-1');
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
    await expect(repository.listExecutions('task-1')).resolves.toEqual([expect.objectContaining({ attempt: 1 }), expect.objectContaining({ attempt: 2 })]);
  });

  it('rejects a stale worker from overwriting a replacement worker lease', async () => {
    const repository = new InMemoryGenerationRepository();
    const first = await repository.claimExecution('task-1', 'provider-1', 'worker-a', 1);
    expect(first?.leaseOwner).toBe('worker-a');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const replacement = await repository.claimExecution('task-1', 'provider-1', 'worker-b', 30_000);
    expect(replacement?.leaseOwner).toBe('worker-b');
    const staleWrite = await repository.saveExecution({ ...first!, providerJobId: 'stale-provider-job', status: 'queued', leaseOwner: 'worker-a', updatedAt: new Date().toISOString() });
    expect(staleWrite).toBe(false);
    await expect(repository.getExecution(first!.id)).resolves.toMatchObject({ leaseOwner: 'worker-b', providerJobId: undefined });
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

  it('creates one durable submission reservation and returns it on repeat', async () => {
    const repository = new InMemoryGenerationRepository();
    const originalTask = task();
    await repository.claimTask(originalTask);
    const leased = await repository.claimExecution(originalTask.id, 'provider-1', 'worker-a', 30_000);
    const first = await repository.reserveSubmission(originalTask, leased!, 'provider-1', originalTask.idempotencyKey);
    const second = await repository.reserveSubmission(originalTask, leased!, 'provider-1', originalTask.idempotencyKey);
    expect(first).toMatchObject({ taskId: 'task-1', executionId: leased!.id, providerId: 'provider-1', idempotencyKey: 'idem-1', status: 'pending', attempt: 0 });
    expect(second).toEqual(first);
    expect(second?.requestPayload).toEqual(originalTask.request);
  });

  it('rejects a stale execution from reserving a submission', async () => {
    const repository = new InMemoryGenerationRepository();
    const originalTask = task();
    await repository.claimTask(originalTask);
    const first = await repository.claimExecution(originalTask.id, 'provider-1', 'worker-a', 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const replacement = await repository.claimExecution(originalTask.id, 'provider-1', 'worker-b', 30_000);
    await expect(repository.reserveSubmission(originalTask, first!, 'provider-1', originalTask.idempotencyKey)).resolves.toBeUndefined();
    await expect(repository.reserveSubmission(originalTask, replacement!, 'provider-1', originalTask.idempotencyKey)).resolves.toMatchObject({ leaseOwner: 'worker-b' });
  });

  it('does not reuse a submission key across different executions', async () => {
    const repository = new InMemoryGenerationRepository();
    const originalTask = task();
    await repository.claimTask(originalTask);
    const first = await repository.claimExecution(originalTask.id, 'provider-1', 'worker-a', 30_000);
    const reservation = await repository.reserveSubmission(originalTask, first!, 'provider-1', originalTask.idempotencyKey);
    expect(reservation).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const replacement = await repository.claimExecution(originalTask.id, 'provider-1', 'worker-b', 30_000);
    await expect(repository.reserveSubmission(originalTask, replacement!, 'provider-1', originalTask.idempotencyKey)).rejects.toThrow('belongs to another generation execution');
  });

  it('atomically acknowledges submission and persists task plus execution state', async () => {
    const repository = new InMemoryGenerationRepository();
    const originalTask = task();
    await repository.claimTask(originalTask);
    const leased = await repository.claimExecution(originalTask.id, 'provider-1', 'worker-a', 30_000);
    const reservation = await repository.reserveSubmission(originalTask, leased!, 'provider-1', originalTask.idempotencyKey);
    const claimed = await repository.claimSubmission(reservation!.id, 'worker-a', 30_000);
    const completedAt = '2026-09-01T00:00:03.000Z';
    const updatedTask = { ...originalTask, status: 'completed' as const, updatedAt: completedAt };
    const updatedExecution = { ...leased!, status: 'completed' as const, providerJobId: 'provider-job-atomic-1', updatedAt: completedAt };
    const result = await repository.acknowledgeSubmissionAndSaveState(reservation!.id, 'worker-a', claimed!.leaseToken!, leased!.leaseToken!, 'provider-job-atomic-1', updatedTask, updatedExecution);
    expect(result).toMatchObject({ submission: { status: 'submitted', providerJobId: 'provider-job-atomic-1' }, task: { status: 'completed' }, execution: { status: 'completed', providerJobId: 'provider-job-atomic-1' } });
    await expect(repository.getTask(originalTask.id)).resolves.toMatchObject({ status: 'completed' });
    await expect(repository.getExecution(leased!.id)).resolves.toMatchObject({ status: 'completed', providerJobId: 'provider-job-atomic-1' });
  });

  it('rejects a stale submission lease atomically without changing submission, task, or execution', async () => {
    const repository = new InMemoryGenerationRepository();
    const originalTask = task();
    await repository.claimTask(originalTask);
    const leased = await repository.claimExecution(originalTask.id, 'provider-1', 'worker-a', 30_000);
    const reservation = await repository.reserveSubmission(originalTask, leased!, 'provider-1', originalTask.idempotencyKey);
    const staleSubmission = await repository.claimSubmission(reservation!.id, 'worker-a', 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const replacement = await repository.claimSubmission(reservation!.id, 'worker-b', 30_000);
    const result = await repository.acknowledgeSubmissionAndSaveState(reservation!.id, 'worker-a', staleSubmission!.leaseToken!, leased!.leaseToken!, 'stale-job', { ...originalTask, status: 'completed', updatedAt: '2026-09-01T00:00:04.000Z' }, { ...leased!, status: 'completed', providerJobId: 'stale-job', updatedAt: '2026-09-01T00:00:04.000Z' });
    expect(result).toBeUndefined();
    await expect(repository.getSubmissionByIdempotencyKey('provider-1', originalTask.idempotencyKey)).resolves.toMatchObject({ status: 'submitting', leaseOwner: 'worker-b', leaseToken: replacement!.leaseToken });
    await expect(repository.getTask(originalTask.id)).resolves.toMatchObject({ status: 'queued' });
    await expect(repository.getExecution(leased!.id)).resolves.toMatchObject({ status: 'queued', providerJobId: undefined });
  });

  it('rejects a stale execution fencing token atomically without acknowledging the outbox', async () => {
    const repository = new InMemoryGenerationRepository();
    const originalTask = task();
    await repository.claimTask(originalTask);
    const leased = await repository.claimExecution(originalTask.id, 'provider-1', 'worker-a', 30_000);
    const reservation = await repository.reserveSubmission(originalTask, leased!, 'provider-1', originalTask.idempotencyKey);
    const claimed = await repository.claimSubmission(reservation!.id, 'worker-a', 30_000);
    const replacement = await repository.claimExecution(originalTask.id, 'provider-1', 'worker-b', 30_000);
    const result = await repository.acknowledgeSubmissionAndSaveState(reservation!.id, 'worker-a', claimed!.leaseToken!, leased!.leaseToken!, 'stale-execution-job', { ...originalTask, status: 'completed', updatedAt: '2026-09-01T00:00:05.000Z' }, { ...leased!, status: 'completed', providerJobId: 'stale-execution-job', updatedAt: '2026-09-01T00:00:05.000Z' });
    expect(result).toBeUndefined();
    await expect(repository.getSubmissionByIdempotencyKey('provider-1', originalTask.idempotencyKey)).resolves.toMatchObject({ status: 'submitting', leaseOwner: 'worker-a', leaseToken: claimed!.leaseToken });
    await expect(repository.getTask(originalTask.id)).resolves.toMatchObject({ status: 'queued' });
    await expect(repository.getExecution(leased!.id)).resolves.toMatchObject({ status: 'queued', leaseOwner: 'worker-b', leaseToken: replacement!.leaseToken, providerJobId: undefined });
  });

  it('makes a repeated atomic acknowledgement idempotent after the first commit', async () => {
    const repository = new InMemoryGenerationRepository();
    const originalTask = task();
    await repository.claimTask(originalTask);
    const leased = await repository.claimExecution(originalTask.id, 'provider-1', 'worker-a', 30_000);
    const reservation = await repository.reserveSubmission(originalTask, leased!, 'provider-1', originalTask.idempotencyKey);
    const claimed = await repository.claimSubmission(reservation!.id, 'worker-a', 30_000);
    const completedAt = '2026-09-01T00:00:06.000Z';
    const updatedTask = { ...originalTask, status: 'completed' as const, updatedAt: completedAt };
    const updatedExecution = { ...leased!, status: 'completed' as const, providerJobId: 'provider-job-idempotent-1', updatedAt: completedAt };
    const first = await repository.acknowledgeSubmissionAndSaveState(reservation!.id, 'worker-a', claimed!.leaseToken!, leased!.leaseToken!, 'provider-job-idempotent-1', updatedTask, updatedExecution);
    const second = await repository.acknowledgeSubmissionAndSaveState(reservation!.id, 'worker-a', 'stale-submission-token', leased!.leaseToken!, 'provider-job-idempotent-1', updatedTask, updatedExecution);
    expect(second).toEqual(first);
  });
});

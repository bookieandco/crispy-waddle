import { describe, expect, it } from 'vitest';
import type { GenerationProvider, GenerationResult } from './generation-provider';
import type { GenerationTask } from './generation-task';
import { GenerationSubmissionCoordinator } from './generation-submission-coordinator';
import { InMemoryGenerationRepository } from './generation-repository';

function createTask(): GenerationTask {
  return {
    id: 'task-coordinator-1',
    projectId: 'project-1',
    request: {
      requestId: 'task-coordinator-1',
      projectId: 'project-1',
      modality: 'image',
      prompt: 'coordinator test',
      model: { id: 'model-1', providerId: 'provider-1' },
      parameters: {},
    },
    idempotencyKey: 'task-coordinator-1',
    status: 'queued',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

function result(task: GenerationTask): GenerationResult {
  return { requestId: task.request.requestId, providerId: 'provider-1', status: 'completed', assetIds: [], providerJobId: 'provider-job-coordinator-1' };
}

function provider(task: GenerationTask): GenerationProvider {
  return {
    descriptor: { id: 'provider-1', name: 'Test Provider', kind: 'comfyui', endpoint: 'http://provider.test', capabilities: ['text-to-image'], models: ['model-1'], health: 'healthy' },
    async submit(): Promise<GenerationResult> { return result(task); },
    async status(providerJobId: string): Promise<GenerationResult> { return { ...result(task), providerJobId }; },
    async cancel(): Promise<void> {},
  };
}

describe('GenerationSubmissionCoordinator', () => {
  it('uses the atomic acknowledgement boundary instead of separate ack and state writes', async () => {
    const repository = new InMemoryGenerationRepository();
    const task = createTask();
    await repository.claimTask(task);
    const execution = await repository.claimExecution(task.id, 'provider-1', 'worker-a', 30_000);
    expect(execution?.leaseToken).toBeDefined();

    repository.acknowledgeSubmission = async () => { throw new Error('legacy acknowledgeSubmission path must not be used'); };
    repository.saveState = async () => { throw new Error('separate saveState path must not be used for provider acknowledgement'); };

    const coordinator = new GenerationSubmissionCoordinator(repository, 'worker-a', 30_000);
    const { result: submitted, submission } = await coordinator.submit(task, execution!, provider(task));

    expect(submitted?.providerJobId).toBe('provider-job-coordinator-1');
    expect(submission).toMatchObject({ status: 'submitted', providerJobId: 'provider-job-coordinator-1' });
    await expect(repository.getTask(task.id)).resolves.toMatchObject({ status: 'completed' });
    await expect(repository.getExecution(execution!.id)).resolves.toMatchObject({ status: 'completed', providerJobId: 'provider-job-coordinator-1' });
  });

  it('does not partially acknowledge when the execution fencing token is stale', async () => {
    const repository = new InMemoryGenerationRepository();
    const task = createTask();
    await repository.claimTask(task);
    const execution = await repository.claimExecution(task.id, 'provider-1', 'worker-a', 30_000);
    const reservation = await repository.reserveSubmission(task, execution!, 'provider-1', task.idempotencyKey);
    const claimed = await repository.claimSubmission(reservation!.id, 'worker-a', 30_000);
    const replacement = await repository.claimExecution(task.id, 'provider-1', 'worker-b', 30_000);
    expect(replacement?.leaseToken).not.toBe(execution?.leaseToken);

    const staleResult = await repository.acknowledgeSubmissionAndSaveState(
      reservation!.id,
      'worker-a',
      claimed!.leaseToken!,
      execution!.leaseToken!,
      'provider-job-stale-1',
      { ...task, status: 'completed', updatedAt: '2026-09-01T00:00:01.000Z' },
      { ...execution!, status: 'completed', providerJobId: 'provider-job-stale-1', updatedAt: '2026-09-01T00:00:01.000Z' },
    );

    expect(staleResult).toBeUndefined();
    await expect(repository.getTask(task.id)).resolves.toMatchObject({ status: 'queued' });
    await expect(repository.getExecution(execution!.id)).resolves.toMatchObject({ leaseOwner: 'worker-b', providerJobId: undefined });
    await expect(repository.getSubmissionByIdempotencyKey('provider-1', task.idempotencyKey)).resolves.toMatchObject({ status: 'submitting', leaseOwner: 'worker-a' });
  });
});

import { describe, expect, it } from 'vitest';
import type { GenerationProvider, GenerationResult } from './generation-provider';
import type { GenerationTask } from './generation-task';
import { GenerationSubmissionReconciler } from './generation-submission-reconciler';
import { InMemoryGenerationRepository } from './generation-repository';

function task(): GenerationTask {
  return { id: 'task-reconciler-1', projectId: 'project-1', request: { requestId: 'task-reconciler-1', projectId: 'project-1', modality: 'image', prompt: 'reconciler test', model: { id: 'model-1', providerId: 'provider-1' }, parameters: {} }, idempotencyKey: 'task-reconciler-1', status: 'queued', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' };
}
function recovered(t: GenerationTask): GenerationResult { return { requestId: t.request.requestId, providerId: 'provider-1', status: 'completed', assetIds: [], providerJobId: 'provider-job-reconciler-1' }; }
function provider(t: GenerationTask): GenerationProvider {
  return { descriptor: { id: 'provider-1', name: 'Test Provider', kind: 'comfyui', endpoint: 'http://provider.test', capabilities: ['text-to-image'], models: ['model-1'], health: 'healthy' }, submissionGuarantee: 'recoverable', async submit(): Promise<GenerationResult> { return recovered(t); }, async findByIdempotencyKey(): Promise<GenerationResult | undefined> { return recovered(t); }, async status(providerJobId: string): Promise<GenerationResult> { return { ...recovered(t), providerJobId }; }, async cancel(): Promise<void> {} };
}

describe('GenerationSubmissionReconciler', () => {
  it('claims an expired submission and atomically reconciles an already-created provider job', async () => {
    const repository = new InMemoryGenerationRepository();
    const t = task(); await repository.claimTask(t);
    const execution = await repository.claimExecution(t.id, 'provider-1', 'worker-a', 30_000);
    const reserved = await repository.reserveSubmission(t, execution!, 'provider-1', t.idempotencyKey);
    const old = await repository.claimSubmission(reserved!.id, 'worker-a', 1); expect(old?.status).toBe('submitting');
    await new Promise((resolve) => setTimeout(resolve, 5));

    const reconciler = new GenerationSubmissionReconciler(repository, new Map([['provider-1', provider(t)]]), 'worker-b', 30_000);
    const outcome = await reconciler.runOnce(10);

    expect(outcome).toMatchObject({ scanned: 1, claimed: 1, recovered: 1, resubmitted: 0, failed: 0 });
    await expect(repository.getSubmissionByIdempotencyKey('provider-1', t.idempotencyKey)).resolves.toMatchObject({ status: 'submitted', providerJobId: 'provider-job-reconciler-1' });
    await expect(repository.getTask(t.id)).resolves.toMatchObject({ status: 'completed' });
    await expect(repository.getExecution(execution!.id)).resolves.toMatchObject({ status: 'completed', providerJobId: 'provider-job-reconciler-1', leaseOwner: 'worker-b' });
  });

  it('fences concurrent sweepers so only one worker can claim the same submission', async () => {
    const repository = new InMemoryGenerationRepository();
    const t = task(); await repository.claimTask(t);
    const execution = await repository.claimExecution(t.id, 'provider-1', 'worker-a', 30_000);
    const reserved = await repository.reserveSubmission(t, execution!, 'provider-1', t.idempotencyKey);
    const old = await repository.claimSubmission(reserved!.id, 'worker-a', 1); expect(old?.status).toBe('submitting');
    await new Promise((resolve) => setTimeout(resolve, 5));

    const providers = new Map([['provider-1', provider(t)]]);
    const a = new GenerationSubmissionReconciler(repository, providers, 'worker-b', 30_000);
    const b = new GenerationSubmissionReconciler(repository, providers, 'worker-c', 30_000);
    const [first, second] = await Promise.all([a.runOnce(10), b.runOnce(10)]);

    expect(first.claimed + second.claimed).toBe(1);
    expect(first.recovered + second.recovered).toBe(1);
    await expect(repository.getSubmissionByIdempotencyKey('provider-1', t.idempotencyKey)).resolves.toMatchObject({ status: 'submitted', providerJobId: 'provider-job-reconciler-1' });
  });

  it('does not retry a non-idempotent provider after no provider job is found', async () => {
    const repository = new InMemoryGenerationRepository();
    const t = task(); await repository.claimTask(t);
    const execution = await repository.claimExecution(t.id, 'provider-1', 'worker-a', 30_000);
    const reserved = await repository.reserveSubmission(t, execution!, 'provider-1', t.idempotencyKey);
    const old = await repository.claimSubmission(reserved!.id, 'worker-a', 1); expect(old?.status).toBe('submitting');
    await new Promise((resolve) => setTimeout(resolve, 5));

    const nonIdempotent: GenerationProvider = { descriptor: { id: 'provider-1', name: 'Unsafe Provider', kind: 'comfyui', endpoint: 'http://provider.test', capabilities: ['text-to-image'], models: ['model-1'], health: 'healthy' }, submissionGuarantee: 'non-idempotent', async submit(): Promise<GenerationResult> { throw new Error('must not resubmit'); }, async status(providerJobId: string): Promise<GenerationResult> { return { ...recovered(t), providerJobId }; }, async cancel(): Promise<void> {} };
    const reconciler = new GenerationSubmissionReconciler(repository, new Map([['provider-1', nonIdempotent]]), 'worker-b', 30_000);
    const outcome = await reconciler.runOnce(10);

    expect(outcome.failed).toBe(0);
    expect(outcome.deferred).toBe(1);
    await expect(repository.getSubmissionByIdempotencyKey('provider-1', t.idempotencyKey)).resolves.toMatchObject({ status: 'recovery_required', providerJobId: undefined });
  });
});

import { describe, expect, it } from 'vitest';
import { GenerationRegistry } from './generation-registry';
import type { GenerationProvider, GenerationRequest, GenerationResult } from './generation-provider';
import { GenerationService } from './generation-service';
import { InMemoryGenerationRepository } from './generation-repository';
import { generationTaskFromRequest } from './generation-task';
import { InMemoryGeneratedAssetRepository } from './generated-asset-resolver';

function createRegistry(): GenerationRegistry {
  const registry = new GenerationRegistry();
  registry.registerProvider({
    id: 'comfy-local', name: 'ComfyUI', kind: 'comfyui',
    endpoint: 'http://comfyui.test',
    capabilities: ['text-to-image', 'text-to-video', 'image-to-video'],
    models: ['test-model'], health: 'healthy',
  });
  registry.registerModel({
    id: 'test-model', providerId: 'comfy-local', name: 'Test Model', version: '1',
    modalities: ['image', 'video'], capabilities: ['text-to-image', 'text-to-video'], baseModel: 'test-base',
  });
  return registry;
}

function createRequest(registry: GenerationRegistry, requestId = 'generation-1'): GenerationRequest {
  return {
    requestId, projectId: 'project-1', modality: 'image', prompt: 'cinematic test shot',
    model: registry.getModel('test-model')!, parameters: {},
  };
}

function createQueuedResult(request: GenerationRequest, providerJobId: string): GenerationResult {
  return { requestId: request.requestId, providerId: 'comfy-local', status: 'queued', assetIds: [], providerJobId };
}

describe('GenerationService end-to-end', () => {
  it('submits, refreshes, and persists a completed generated asset', async () => {
    const registry = createRegistry();
    let statusCalls = 0;
    const provider: GenerationProvider = {
      descriptor: registry.getProvider('comfy-local')!,
      async submit(request: GenerationRequest): Promise<GenerationResult> {
        return createQueuedResult(request, 'provider-job-1');
      },
      async status(providerJobId: string): Promise<GenerationResult> {
        statusCalls += 1;
        return {
          requestId: 'generation-1', providerId: 'comfy-local', status: 'completed', assetIds: [], providerJobId,
          metadata: { outputs: [{ uri: 'http://comfyui.test/view?filename=shot.png&type=output', mediaType: 'image', mimeType: 'image/png' }] },
        };
      },
      async cancel(): Promise<void> {},
    };

    const assets = new InMemoryGeneratedAssetRepository();
    const service = new GenerationService(registry, new Map([['comfy-local', provider]]), assets);
    const job = await service.submit(createRequest(registry));

    expect(job.status).toBe('queued');
    const completed = await service.refresh(job.id);
    expect(completed.status).toBe('completed');
    expect(statusCalls).toBe(1);

    const stored = await assets.listByGenerationJob('generation-1');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      projectId: 'project-1', providerId: 'comfy-local', mediaType: 'image',
      uri: 'http://comfyui.test/view?filename=shot.png&type=output',
      mimeType: 'image/png', prompt: 'cinematic test shot', modelId: 'test-model',
    });
  });

  it('recovers an already-submitted provider job instead of submitting a duplicate', async () => {
    const registry = createRegistry();
    const request = createRequest(registry, 'recovery-1');
    const repository = new InMemoryGenerationRepository();
    const task = generationTaskFromRequest(request, { idempotencyKey: request.requestId });
    await repository.claimTask(task);
    await repository.saveExecution({
      id: `${task.id}:attempt:1`, taskId: task.id, providerId: 'comfy-local', attempt: 1,
      status: 'running', leaseOwner: 'crashed-worker', leaseExpiresAt: new Date(Date.now() - 1_000).toISOString(),
      createdAt: task.createdAt, updatedAt: task.updatedAt,
    });

    let lookupCalls = 0;
    let submitCalls = 0;
    const provider: GenerationProvider = {
      descriptor: registry.getProvider('comfy-local')!,
      async findByIdempotencyKey(key: string): Promise<GenerationResult | undefined> {
        lookupCalls += 1;
        expect(key).toBe(request.requestId);
        return { ...createQueuedResult(request, 'provider-recovered-1'), status: 'running' };
      },
      async submit(): Promise<GenerationResult> {
        submitCalls += 1;
        return createQueuedResult(request, 'provider-duplicate');
      },
      async status(providerJobId: string): Promise<GenerationResult> {
        return createQueuedResult(request, providerJobId);
      },
      async cancel(): Promise<void> {},
    };

    const service = new GenerationService(
      registry,
      new Map([['comfy-local', provider]]),
      undefined,
      repository,
      'recovery-worker',
      30_000,
    );

    const job = await service.submit(request);
    expect(lookupCalls).toBe(1);
    expect(submitCalls).toBe(0);
    expect(job.providerJobId).toBe('provider-recovered-1');

    const execution = (await repository.listExecutions(task.id)).at(-1);
    expect(execution).toMatchObject({ providerJobId: 'provider-recovered-1', status: 'running' });
  });

  it('does not re-submit when a durable execution already has a provider job', async () => {
    const registry = createRegistry();
    const request = createRequest(registry, 'durable-1');
    const repository = new InMemoryGenerationRepository();
    const task = generationTaskFromRequest(request, { idempotencyKey: request.requestId });
    await repository.claimTask(task);
    await repository.saveExecution({
      id: `${task.id}:attempt:1`, taskId: task.id, providerId: 'comfy-local', providerJobId: 'provider-existing-1',
      attempt: 1, status: 'running', createdAt: task.createdAt, updatedAt: task.updatedAt,
    });

    let lookupCalls = 0;
    let submitCalls = 0;
    const provider: GenerationProvider = {
      descriptor: registry.getProvider('comfy-local')!,
      async findByIdempotencyKey(): Promise<GenerationResult | undefined> {
        lookupCalls += 1;
        return undefined;
      },
      async submit(): Promise<GenerationResult> {
        submitCalls += 1;
        return createQueuedResult(request, 'provider-duplicate');
      },
      async status(providerJobId: string): Promise<GenerationResult> {
        return createQueuedResult(request, providerJobId);
      },
      async cancel(): Promise<void> {},
    };

    const service = new GenerationService(registry, new Map([['comfy-local', provider]]), undefined, repository, 'worker-1');
    const job = await service.submit(request);

    expect(job.providerJobId).toBe('provider-existing-1');
    expect(lookupCalls).toBe(0);
    expect(submitCalls).toBe(0);
  });

  it('waits for the owning concurrent worker to publish the provider job before returning', async () => {
    const registry = createRegistry();
    const request = createRequest(registry, 'concurrent-1');
    const repository = new InMemoryGenerationRepository();
    let submitCalls = 0;
    let releaseSubmit!: () => void;
    const submitReleased = new Promise<void>((resolve) => { releaseSubmit = resolve; });

    const provider: GenerationProvider = {
      descriptor: registry.getProvider('comfy-local')!,
      async submit(submission: GenerationRequest, options): Promise<GenerationResult> {
        submitCalls += 1;
        expect(options?.idempotencyKey).toBe(request.requestId);
        await submitReleased;
        return createQueuedResult(submission, 'provider-concurrent-1');
      },
      async status(providerJobId: string): Promise<GenerationResult> {
        return createQueuedResult(request, providerJobId);
      },
      async cancel(): Promise<void> {},
    };

    const providers = new Map([['comfy-local', provider]]);
    const workerA = new GenerationService(registry, providers, undefined, repository, 'worker-a', 30_000, 1_000, 5);
    const workerB = new GenerationService(registry, providers, undefined, repository, 'worker-b', 30_000, 1_000, 5);

    const first = workerA.submit(request);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = workerB.submit(request);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(submitCalls).toBe(1);

    releaseSubmit();
    const [jobA, jobB] = await Promise.all([first, second]);

    expect(jobA.providerJobId).toBe('provider-concurrent-1');
    expect(jobB.providerJobId).toBe('provider-concurrent-1');
    expect(submitCalls).toBe(1);

    const execution = (await repository.listExecutions(request.requestId)).at(-1);
    expect(execution).toMatchObject({ providerJobId: 'provider-concurrent-1' });
  });

  it('falls back to provider submission when recovery lookup is unavailable', async () => {
    const registry = createRegistry();
    const request = createRequest(registry, 'fallback-1');
    let submitCalls = 0;
    let receivedKey: string | undefined;
    const provider: GenerationProvider = {
      descriptor: registry.getProvider('comfy-local')!,
      async submit(submission: GenerationRequest, options): Promise<GenerationResult> {
        submitCalls += 1;
        receivedKey = options?.idempotencyKey;
        return createQueuedResult(submission, 'provider-fallback-1');
      },
      async status(providerJobId: string): Promise<GenerationResult> {
        return createQueuedResult(request, providerJobId);
      },
      async cancel(): Promise<void> {},
    };

    const service = new GenerationService(registry, new Map([['comfy-local', provider]]));
    const job = await service.submit(request);

    expect(job.providerJobId).toBe('provider-fallback-1');
    expect(submitCalls).toBe(1);
    expect(receivedKey).toBe(request.requestId);
  });

  it('does not submit after the execution lease has been replaced', async () => {
    const registry = createRegistry();
    const request = createRequest(registry, 'stale-before-submit-1');
    const repository = new InMemoryGenerationRepository();
    const task = generationTaskFromRequest(request, { idempotencyKey: request.requestId });
    await repository.claimTask(task);
    const stale = await repository.claimExecution(task.id, 'comfy-local', 'worker-a', 1);
    expect(stale?.leaseToken).toBeDefined();
    await repository.saveState({ ...task, status: 'running', updatedAt: new Date().toISOString() }, { ...stale!, status: 'running', leaseExpiresAt: new Date(Date.now() - 1).toISOString(), updatedAt: new Date().toISOString() });
    const replacement = await repository.claimExecution(task.id, 'comfy-local', 'worker-b', 30_000);
    expect(replacement?.leaseToken).not.toBe(stale?.leaseToken);

    let submitCalls = 0;
    const provider: GenerationProvider = {
      descriptor: registry.getProvider('comfy-local')!,
      async submit(): Promise<GenerationResult> {
        submitCalls += 1;
        return createQueuedResult(request, 'should-not-submit');
      },
      async status(providerJobId: string): Promise<GenerationResult> {
        return createQueuedResult(request, providerJobId);
      },
      async cancel(): Promise<void> {},
    };

    const service = new GenerationService(registry, new Map([['comfy-local', provider]]), undefined, repository, 'worker-a', 30_000, 10, 1);
    const job = await service.submit(request);

    expect(submitCalls).toBe(0);
    expect(job.providerJobId).toBeUndefined();
    expect((await repository.getExecution(task.id + ':attempt:1'))).toMatchObject({ leaseOwner: 'worker-b' });
  });

  it('blocks a provider declared non-idempotent from automatic leased submission', async () => {
    const registry = createRegistry();
    const request = createRequest(registry, 'non-idempotent-1');
    let submitCalls = 0;
    const provider: GenerationProvider = {
      descriptor: registry.getProvider('comfy-local')!,
      submissionGuarantee: 'non-idempotent',
      async submit(): Promise<GenerationResult> {
        submitCalls += 1;
        return createQueuedResult(request, 'should-not-submit');
      },
      async status(providerJobId: string): Promise<GenerationResult> { return createQueuedResult(request, providerJobId); },
      async cancel(): Promise<void> {},
    };

    const service = new GenerationService(registry, new Map([['comfy-local', provider]]));
    await expect(service.submit(request)).rejects.toThrow(/non-idempotent/);
    expect(submitCalls).toBe(0);
  });

  it('does not let a stale refresh overwrite a replacement worker execution', async () => {
    const registry = createRegistry();
    const request = createRequest(registry, 'refresh-fence-1');
    const repository = new InMemoryGenerationRepository();
    const task = generationTaskFromRequest(request, { idempotencyKey: request.requestId });
    await repository.claimTask(task);
    const stale = await repository.claimExecution(task.id, 'comfy-local', 'worker-a', 1);
    expect(stale?.leaseToken).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const replacement = await repository.claimExecution(task.id, 'comfy-local', 'worker-b', 30_000);
    expect(replacement?.leaseToken).not.toBe(stale?.leaseToken);
    await repository.saveExecution({ ...replacement!, providerJobId: 'provider-current-1', status: 'running' });

    const provider: GenerationProvider = {
      descriptor: registry.getProvider('comfy-local')!,
      async submit(): Promise<GenerationResult> { throw new Error('submit should not run'); },
      async status(): Promise<GenerationResult> {
        return { ...createQueuedResult(request, 'provider-current-1'), status: 'completed' };
      },
      async cancel(): Promise<void> {},
    };

    const service = new GenerationService(registry, new Map([['comfy-local', provider]]), undefined, repository, 'worker-a');
    const refreshed = await service.refresh(task.id);

    expect(refreshed.providerJobId).toBe('provider-current-1');
    expect(refreshed.status).toBe('running');
    await expect(repository.getExecution(task.id + ':attempt:1')).resolves.toMatchObject({ leaseOwner: 'worker-b', status: 'running', providerJobId: 'provider-current-1' });
  });

  it('does not let a stale cancel overwrite a replacement worker execution', async () => {
    const registry = createRegistry();
    const request = createRequest(registry, 'cancel-fence-1');
    const repository = new InMemoryGenerationRepository();
    const task = generationTaskFromRequest(request, { idempotencyKey: request.requestId });
    await repository.claimTask(task);
    const first = await repository.claimExecution(task.id, 'comfy-local', 'worker-a', 1);
    await repository.saveExecution({ ...first!, providerJobId: 'provider-current-2', status: 'running' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const replacement = await repository.claimExecution(task.id, 'comfy-local', 'worker-b', 30_000);
    await repository.saveExecution({ ...replacement!, providerJobId: 'provider-current-2', status: 'running' });

    let cancelCalls = 0;
    const provider: GenerationProvider = {
      descriptor: registry.getProvider('comfy-local')!,
      async submit(): Promise<GenerationResult> { throw new Error('submit should not run'); },
      async status(providerJobId: string): Promise<GenerationResult> { return createQueuedResult(request, providerJobId); },
      async cancel(): Promise<void> { cancelCalls += 1; },
    };

    const service = new GenerationService(registry, new Map([['comfy-local', provider]]), undefined, repository, 'worker-a');
    const cancelled = await service.cancel(task.id);

    expect(cancelCalls).toBe(1);
    expect(cancelled.status).toBe('running');
    await expect(repository.getExecution(task.id + ':attempt:1')).resolves.toMatchObject({ leaseOwner: 'worker-b', status: 'running', providerJobId: 'provider-current-2' });
  });
});

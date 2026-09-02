import type { GenerationRegistry } from './generation-registry';
import type { GenerationProvider, GenerationRequest, GenerationResult } from './generation-provider';
import type { GeneratedAssetRepository, ProviderOutput } from './generated-asset-resolver';
import type { EditOperation } from './edit-plan';
import type { GenerationExecution } from './generation-execution';
import type { GenerationRepository } from './generation-repository';
import { generationExecutionFromResult } from './generation-execution';
import { generationTaskFromRequest, type GenerationTask } from './generation-task';
import { resolveGenerationOutputs } from './generated-asset-resolver';

function assertRequestCompatibility(registry: GenerationRegistry, request: GenerationRequest): void {
  const model = registry.getModel(request.model.id);
  if (!model) throw new Error(`Model is not registered: ${request.model.id}`);
  if (!model.modalities.includes(request.modality)) throw new Error(`Model ${model.id} does not support modality: ${request.modality}`);
  const provider = registry.getProvider(model.providerId);
  if (!provider) throw new Error(`Provider is not registered: ${model.providerId}`);
  const requiredCapability = request.modality === 'video'
    ? (request.references?.some((reference) => reference.role === 'image') ? 'image-to-video' : 'text-to-video')
    : request.modality === 'image' ? 'text-to-image' : request.modality === 'subtitle' ? 'text-to-subtitle' : undefined;
  if (requiredCapability && !provider.capabilities.includes(requiredCapability)) throw new Error(`Provider ${provider.id} does not support capability: ${requiredCapability}`);
  for (const selected of request.loras ?? []) {
    const registeredLoRA = registry.getLoRA(selected.lora.id);
    if (!registeredLoRA) throw new Error(`LoRA is not registered: ${selected.lora.id}`);
    if (!registeredLoRA.modalities.includes(request.modality)) throw new Error(`LoRA ${registeredLoRA.id} does not support modality: ${request.modality}`);
    if (registeredLoRA.baseModel && model.baseModel && registeredLoRA.baseModel !== model.baseModel) throw new Error(`LoRA ${registeredLoRA.id} is incompatible with model ${model.id}`);
    const weight = selected.weight ?? registeredLoRA.weight.recommended ?? 1;
    if (weight < registeredLoRA.weight.min || weight > registeredLoRA.weight.max) throw new Error(`LoRA weight out of range: ${registeredLoRA.id}`);
  }
}

export type GenerationJob = { id: string; request: GenerationRequest; providerId: string; status: GenerationResult['status']; providerJobId?: string; error?: string; createdAt: string; updatedAt: string };

function readProviderOutputs(result: GenerationResult): ProviderOutput[] {
  const raw = result.metadata?.outputs;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const record = value as Record<string, unknown>;
    if (typeof record.uri !== 'string') return [];
    return [{ uri: record.uri, mediaType: typeof record.mediaType === 'string' ? record.mediaType as ProviderOutput['mediaType'] : undefined, mimeType: typeof record.mimeType === 'string' ? record.mimeType : undefined, sha256: typeof record.sha256 === 'string' ? record.sha256 : undefined, metadata: record.metadata && typeof record.metadata === 'object' ? record.metadata as Record<string, unknown> : undefined }];
  });
}

function jobFromTask(task: GenerationTask, execution?: GenerationExecution): GenerationJob {
  return { id: task.id, request: task.request, providerId: execution?.providerId ?? task.request.model.providerId, status: execution?.status ?? task.status, providerJobId: execution?.providerJobId, error: execution?.error ?? task.error, createdAt: task.createdAt, updatedAt: task.updatedAt };
}

export class GenerationService {
  private readonly jobs = new Map<string, GenerationJob>();
  private readonly workerId: string;
  private readonly executionLeaseMs: number;
  private readonly executionWaitMs: number;
  private readonly executionPollMs: number;

  constructor(
    private readonly registry: GenerationRegistry,
    private readonly providers: Map<string, GenerationProvider>,
    private readonly assetRepository?: GeneratedAssetRepository,
    private readonly generationRepository?: GenerationRepository,
    workerId?: string,
    executionLeaseMs = 30_000,
    executionWaitMs = 5_000,
    executionPollMs = 25,
  ) {
    this.workerId = workerId ?? `director-worker:${Math.random().toString(36).slice(2)}`;
    this.executionLeaseMs = executionLeaseMs;
    this.executionWaitMs = executionWaitMs;
    this.executionPollMs = executionPollMs;
  }

  private async persistOutputs(job: GenerationJob, result: GenerationResult): Promise<void> {
    if (!this.assetRepository || result.status !== 'completed') return;
    const outputs = readProviderOutputs(result);
    if (!outputs.length) return;
    const assets = resolveGenerationOutputs(result, { projectId: job.request.projectId, modelId: job.request.model.id, workflowId: typeof job.request.parameters.workflowId === 'string' ? job.request.parameters.workflowId : undefined, workflowVersion: typeof job.request.parameters.workflowVersion === 'number' ? job.request.parameters.workflowVersion : undefined, loras: (job.request.loras ?? []).map(({ lora, weight }) => ({ id: lora.id, weight: weight ?? lora.weight.recommended ?? 1 })), prompt: job.request.prompt }, outputs);
    for (const asset of assets) await this.assetRepository.save(asset);
  }

  private async persistState(task: GenerationTask, execution: GenerationExecution): Promise<void> {
    if (!this.generationRepository) return;
    await this.generationRepository.saveExecution(execution);
    await this.generationRepository.saveTask(task);
  }

  private async waitForExecutionResolution(task: GenerationTask): Promise<GenerationExecution | undefined> {
    if (!this.generationRepository) return undefined;
    const deadline = Date.now() + this.executionWaitMs;
    while (Date.now() < deadline) {
      const execution = (await this.generationRepository.listExecutions(task.id)).at(-1);
      if (execution?.providerJobId || execution?.status === 'completed' || execution?.status === 'failed' || execution?.status === 'cancelled') return execution;
      await new Promise((resolve) => setTimeout(resolve, this.executionPollMs));
    }
    return (await this.generationRepository.listExecutions(task.id)).at(-1);
  }

  async submit(request: GenerationRequest): Promise<GenerationJob> {
    assertRequestCompatibility(this.registry, request);
    const registeredModel = this.registry.getModel(request.model.id)!;
    const provider = this.providers.get(registeredModel.providerId);
    if (!provider) throw new Error(`Provider is not configured: ${registeredModel.providerId}`);
    const normalizedRequest = { ...request, model: registeredModel };
    const now = new Date().toISOString();
    const candidate = generationTaskFromRequest(normalizedRequest, { idempotencyKey: request.requestId });
    candidate.createdAt = now;
    candidate.updatedAt = now;

    let task = candidate;
    let initialExecution: GenerationExecution | undefined;
    if (this.generationRepository) {
      task = await this.generationRepository.claimTask(candidate);
      const executions = await this.generationRepository.listExecutions(task.id);
      const latest = executions.at(-1);
      if (latest?.providerJobId || latest?.status === 'completed' || latest?.status === 'failed' || latest?.status === 'cancelled') {
        const existingJob = jobFromTask(task, latest);
        this.jobs.set(existingJob.id, existingJob);
        return existingJob;
      }
      initialExecution = await this.generationRepository.claimExecution(task.id, registeredModel.providerId, this.workerId, this.executionLeaseMs);
      if (!initialExecution) {
        // Another worker owns the active lease. Wait for its durable result rather
        // than returning a job that has no providerJobId yet.
        const reconciled = await this.waitForExecutionResolution(task);
        const existingJob = jobFromTask(task, reconciled);
        this.jobs.set(existingJob.id, existingJob);
        return existingJob;
      }
    }

    initialExecution ??= { id: `${task.id}:attempt:1`, taskId: task.id, providerId: registeredModel.providerId, attempt: 1, status: 'queued', createdAt: task.createdAt, updatedAt: task.updatedAt };
    const runningExecution: GenerationExecution = { ...initialExecution, status: 'running', leaseOwner: this.workerId, leaseExpiresAt: new Date(Date.now() + this.executionLeaseMs).toISOString(), updatedAt: new Date().toISOString() };
    if (this.generationRepository) await this.generationRepository.saveExecution(runningExecution);
    const initial = jobFromTask(task, runningExecution);
    this.jobs.set(initial.id, initial);

    try {
      if (!initialExecution.providerJobId && provider.findByIdempotencyKey) {
        const recovered = await provider.findByIdempotencyKey(task.idempotencyKey);
        if (recovered) {
          const recoveredAt = new Date().toISOString();
          const recoveredExecution = generationExecutionFromResult(task.id, registeredModel.providerId, recovered, {
            id: initialExecution.id,
            attempt: initialExecution.attempt,
            now: recoveredAt,
          });
          const recoveredTask: GenerationTask = { ...task, status: recovered.status, error: recovered.error, updatedAt: recoveredAt };
          const recoveredJob = jobFromTask(recoveredTask, recoveredExecution);
          this.jobs.set(recoveredJob.id, recoveredJob);
          await this.persistState(recoveredTask, recoveredExecution);
          await this.persistOutputs(recoveredJob, recovered);
          return recoveredJob;
        }
      }

      const result = await provider.submit(initial.request, { idempotencyKey: task.idempotencyKey });
      const completedAt = new Date().toISOString();
      const execution = generationExecutionFromResult(task.id, registeredModel.providerId, result, { id: initialExecution.id, attempt: initialExecution.attempt, now: completedAt });
      const updatedTask: GenerationTask = { ...task, status: result.status, error: result.error, updatedAt: completedAt };
      const job = jobFromTask(updatedTask, execution);
      this.jobs.set(job.id, job);
      await this.persistState(updatedTask, execution);
      await this.persistOutputs(job, result);
      return job;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedAt = new Date().toISOString();
      const failedExecution: GenerationExecution = { ...initialExecution, status: 'failed', error: message, leaseOwner: undefined, leaseExpiresAt: undefined, updatedAt: failedAt };
      const failedTask: GenerationTask = { ...task, status: 'failed', error: message, updatedAt: failedAt };
      const failed = jobFromTask(failedTask, failedExecution);
      this.jobs.set(failed.id, failed);
      await this.persistState(failedTask, failedExecution);
      throw error;
    }
  }

  async submitEditOperation(operation: EditOperation, projectId: string, modelId: string): Promise<GenerationJob> {
    if (operation.kind !== 'srt-counter') throw new Error(`Edit operation is not yet executable through GenerationService: ${operation.kind}`);
    const model = this.registry.getModel(modelId);
    if (!model) throw new Error(`Model is not registered: ${modelId}`);
    if (!model.modalities.includes('subtitle')) throw new Error(`Model ${model.id} does not support subtitle generation`);
    return this.submit({ requestId: `generation:${operation.id}`, projectId, modality: 'subtitle', prompt: operation.intent, model, parameters: { ...(operation.parameters ?? {}), startSeconds: operation.startSeconds, endSeconds: operation.endSeconds, sourceId: operation.sourceId }, references: (operation.referenceUris ?? []).map((uri, index) => ({ assetId: `${operation.id}:reference:${index + 1}`, role: 'image' as const, uri })) });
  }

  getJob(id: string): GenerationJob | undefined { return this.jobs.get(id); }

  async getJobDurable(id: string): Promise<GenerationJob | undefined> {
    const cached = this.jobs.get(id);
    if (cached) return cached;
    if (!this.generationRepository) return undefined;
    const task = await this.generationRepository.getTask(id);
    if (!task) return undefined;
    const executions = await this.generationRepository.listExecutions(id);
    const job = jobFromTask(task, executions.at(-1));
    this.jobs.set(id, job);
    return job;
  }

  async refresh(id: string): Promise<GenerationJob> {
    const job = await this.getJobDurable(id);
    if (!job) throw new Error(`Generation job not found: ${id}`);
    if (!job.providerJobId) return job;
    const provider = this.providers.get(job.providerId);
    if (!provider) throw new Error(`Provider is not configured: ${job.providerId}`);
    const result = await provider.status(job.providerJobId);
    const updatedAt = new Date().toISOString();
    const executions = this.generationRepository ? await this.generationRepository.listExecutions(id) : [];
    const latest = executions.at(-1);
    const updatedExecution: GenerationExecution = latest ? { ...latest, status: result.status, error: result.error, leaseOwner: undefined, leaseExpiresAt: undefined, updatedAt } : generationExecutionFromResult(id, job.providerId, result, { attempt: 1, now: updatedAt });
    const existingTask = this.generationRepository ? await this.generationRepository.getTask(id) : undefined;
    const updatedTask: GenerationTask = existingTask ? { ...existingTask, status: result.status, error: result.error, updatedAt } : generationTaskFromRequest(job.request, { idempotencyKey: id });
    const updated = jobFromTask(updatedTask, updatedExecution);
    this.jobs.set(id, updated);
    await this.persistState(updatedTask, updatedExecution);
    await this.persistOutputs(updated, result);
    return updated;
  }

  async cancel(id: string): Promise<GenerationJob> {
    const job = await this.getJobDurable(id);
    if (!job) throw new Error(`Generation job not found: ${id}`);
    if (job.providerJobId) {
      const provider = this.providers.get(job.providerId);
      if (!provider) throw new Error(`Provider is not configured: ${job.providerId}`);
      await provider.cancel(job.providerJobId);
    }
    const updatedAt = new Date().toISOString();
    const updated: GenerationJob = { ...job, status: 'cancelled', updatedAt };
    this.jobs.set(id, updated);
    if (this.generationRepository) {
      const task = await this.generationRepository.getTask(id);
      const executions = await this.generationRepository.listExecutions(id);
      const latest = executions.at(-1);
      if (task && latest) await this.persistState({ ...task, status: 'cancelled', updatedAt }, { ...latest, status: 'cancelled', leaseOwner: undefined, leaseExpiresAt: undefined, updatedAt });
    }
    return updated;
  }
}

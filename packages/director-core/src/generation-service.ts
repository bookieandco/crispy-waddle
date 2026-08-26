import type { GenerationRegistry } from './generation-registry';
import type { GenerationProvider, GenerationRequest, GenerationResult } from './generation-provider';
import type { GeneratedAssetRepository, ProviderOutput } from './generated-asset-resolver';
import type { EditOperation } from './edit-plan';
import { resolveGenerationOutputs } from './generated-asset-resolver';

function assertRequestCompatibility(registry: GenerationRegistry, request: GenerationRequest): void {
  const model = registry.getModel(request.model.id);
  if (!model) throw new Error(`Model is not registered: ${request.model.id}`);
  if (!model.modalities.includes(request.modality)) {
    throw new Error(`Model ${model.id} does not support modality: ${request.modality}`);
  }

  const provider = registry.getProvider(model.providerId);
  if (!provider) throw new Error(`Provider is not registered: ${model.providerId}`);
  const requiredCapability = request.modality === 'video'
    ? (request.references?.some((reference) => reference.role === 'image') ? 'image-to-video' : 'text-to-video')
    : request.modality === 'image'
      ? 'text-to-image'
      : request.modality === 'subtitle'
        ? 'text-to-subtitle'
        : undefined;
  if (requiredCapability && !provider.capabilities.includes(requiredCapability)) {
    throw new Error(`Provider ${provider.id} does not support capability: ${requiredCapability}`);
  }

  for (const selected of request.loras ?? []) {
    const registeredLoRA = registry.getLoRA(selected.lora.id);
    if (!registeredLoRA) throw new Error(`LoRA is not registered: ${selected.lora.id}`);
    if (!registeredLoRA.modalities.includes(request.modality)) {
      throw new Error(`LoRA ${registeredLoRA.id} does not support modality: ${request.modality}`);
    }
    if (registeredLoRA.baseModel && model.baseModel && registeredLoRA.baseModel !== model.baseModel) {
      throw new Error(`LoRA ${registeredLoRA.id} is incompatible with model ${model.id}`);
    }
    const weight = selected.weight ?? registeredLoRA.weight.recommended ?? 1;
    if (weight < registeredLoRA.weight.min || weight > registeredLoRA.weight.max) {
      throw new Error(`LoRA weight out of range: ${registeredLoRA.id}`);
    }
  }
}

export type GenerationJob = {
  id: string;
  request: GenerationRequest;
  providerId: string;
  status: GenerationResult['status'];
  providerJobId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

function readProviderOutputs(result: GenerationResult): ProviderOutput[] {
  const raw = result.metadata?.outputs;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const record = value as Record<string, unknown>;
    if (typeof record.uri !== 'string') return [];
    return [{
      uri: record.uri,
      mediaType: typeof record.mediaType === 'string' ? record.mediaType as ProviderOutput['mediaType'] : undefined,
      mimeType: typeof record.mimeType === 'string' ? record.mimeType : undefined,
      sha256: typeof record.sha256 === 'string' ? record.sha256 : undefined,
      metadata: record.metadata && typeof record.metadata === 'object'
        ? record.metadata as Record<string, unknown>
        : undefined,
    }];
  });
}

export class GenerationService {
  private readonly jobs = new Map<string, GenerationJob>();

  constructor(
    private readonly registry: GenerationRegistry,
    private readonly providers: Map<string, GenerationProvider>,
    private readonly assetRepository?: GeneratedAssetRepository,
  ) {}

  private async persistOutputs(job: GenerationJob, result: GenerationResult): Promise<void> {
    if (!this.assetRepository || result.status !== 'completed') return;
    const outputs = readProviderOutputs(result);
    if (!outputs.length) return;

    const assets = resolveGenerationOutputs(result, {
      projectId: job.request.projectId,
      modelId: job.request.model.id,
      workflowId: typeof job.request.parameters.workflowId === 'string' ? job.request.parameters.workflowId : undefined,
      workflowVersion: typeof job.request.parameters.workflowVersion === 'number' ? job.request.parameters.workflowVersion : undefined,
      loras: (job.request.loras ?? []).map(({ lora, weight }) => ({
        id: lora.id,
        weight: weight ?? lora.weight.recommended ?? 1,
      })),
      prompt: job.request.prompt,
    }, outputs);

    for (const asset of assets) await this.assetRepository.save(asset);
  }

  async submit(request: GenerationRequest): Promise<GenerationJob> {
    assertRequestCompatibility(this.registry, request);
    const registeredModel = this.registry.getModel(request.model.id)!;
    const provider = this.providers.get(registeredModel.providerId);
    if (!provider) throw new Error(`Provider is not configured: ${registeredModel.providerId}`);

    const now = new Date().toISOString();
    const initial: GenerationJob = {
      id: request.requestId,
      request: { ...request, model: registeredModel },
      providerId: registeredModel.providerId,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(initial.id, initial);

    try {
      const result = await provider.submit(initial.request);
      const job: GenerationJob = {
        ...initial,
        status: result.status,
        providerJobId: result.providerJobId,
        error: result.error,
        updatedAt: new Date().toISOString(),
      };
      this.jobs.set(job.id, job);
      await this.persistOutputs(job, result);
      return job;
    } catch (error) {
      const failed: GenerationJob = {
        ...initial,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        updatedAt: new Date().toISOString(),
      };
      this.jobs.set(failed.id, failed);
      throw error;
    }
  }

  async submitEditOperation(operation: EditOperation, projectId: string, modelId: string): Promise<GenerationJob> {
    if (operation.kind !== 'srt-counter') {
      throw new Error(`Edit operation is not yet executable through GenerationService: ${operation.kind}`);
    }
    const model = this.registry.getModel(modelId);
    if (!model) throw new Error(`Model is not registered: ${modelId}`);
    if (!model.modalities.includes('subtitle')) {
      throw new Error(`Model ${model.id} does not support subtitle generation`);
    }

    return this.submit({
      requestId: `generation:${operation.id}`,
      projectId,
      modality: 'subtitle',
      prompt: operation.intent,
      model,
      parameters: {
        ...(operation.parameters ?? {}),
        startSeconds: operation.startSeconds,
        endSeconds: operation.endSeconds,
        sourceId: operation.sourceId,
      },
      references: (operation.referenceUris ?? []).map((uri, index) => ({
        assetId: `${operation.id}:reference:${index + 1}`,
        role: 'image' as const,
        uri,
      })),
    });
  }

  getJob(id: string): GenerationJob | undefined {
    return this.jobs.get(id);
  }

  async refresh(id: string): Promise<GenerationJob> {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Generation job not found: ${id}`);
    if (!job.providerJobId) return job;
    const provider = this.providers.get(job.providerId);
    if (!provider) throw new Error(`Provider is not configured: ${job.providerId}`);
    const result = await provider.status(job.providerJobId);
    const updated = {
      ...job,
      status: result.status,
      error: result.error,
      updatedAt: new Date().toISOString(),
    };
    this.jobs.set(id, updated);
    await this.persistOutputs(updated, result);
    return updated;
  }

  async cancel(id: string): Promise<GenerationJob> {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Generation job not found: ${id}`);
    if (job.providerJobId) {
      const provider = this.providers.get(job.providerId);
      if (!provider) throw new Error(`Provider is not configured: ${job.providerId}`);
      await provider.cancel(job.providerJobId);
    }
    const updated: GenerationJob = {
      ...job,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    };
    this.jobs.set(id, updated);
    return updated;
  }
}

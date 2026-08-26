import type { GenerationRegistry } from './generation-registry';
import type { GenerationProvider, GenerationRequest, GenerationResult } from './generation-provider';

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
  createdAt: string;
  updatedAt: string;
};

export class GenerationService {
  private readonly jobs = new Map<string, GenerationJob>();

  constructor(
    private readonly registry: GenerationRegistry,
    private readonly providers: Map<string, GenerationProvider>,
  ) {}

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
        updatedAt: new Date().toISOString(),
      };
      this.jobs.set(job.id, job);
      return job;
    } catch (error) {
      const failed: GenerationJob = { ...initial, status: 'failed', updatedAt: new Date().toISOString() };
      this.jobs.set(failed.id, failed);
      throw error;
    }
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
    const updated = { ...job, status: result.status, updatedAt: new Date().toISOString() };
    this.jobs.set(id, updated);
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
    const updated: GenerationJob = { ...job, status: 'failed', updatedAt: new Date().toISOString() };
    this.jobs.set(id, updated);
    return updated;
  }
}

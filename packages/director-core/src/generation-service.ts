import type { GenerationRegistry } from './generation-registry';
import type { GenerationProvider, GenerationRequest, GenerationResult } from './generation-provider';

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
    const registeredModel = this.registry.getModel(request.model.id);
    if (!registeredModel) throw new Error(`Model is not registered: ${request.model.id}`);

    for (const selected of request.loras ?? []) {
      const registeredLoRA = this.registry.getLoRA(selected.lora.id);
      if (!registeredLoRA) throw new Error(`LoRA is not registered: ${selected.lora.id}`);
      const weight = selected.weight ?? registeredLoRA.weight.recommended ?? 1;
      if (weight < registeredLoRA.weight.min || weight > registeredLoRA.weight.max) {
        throw new Error(`LoRA weight out of range: ${registeredLoRA.id}`);
      }
    }

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

    const result = await provider.submit(initial.request);
    const job: GenerationJob = {
      ...initial,
      status: result.status,
      providerJobId: result.providerJobId,
      updatedAt: new Date().toISOString(),
    };
    this.jobs.set(job.id, job);
    return job;
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
}

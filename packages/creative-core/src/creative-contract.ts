import type {
  GenerationJob,
  GenerationRequest,
  GenerationService,
} from '@jhadina/director-core';

export type CreativeSource = 'text' | 'image' | 'asset' | 'mixed';

export type CreativeDestination =
  | 'product'
  | 'advertising'
  | 'social'
  | 'campaign'
  | 'brand'
  | 'general';

export type CreativeIntent = {
  id: string;
  source: CreativeSource;
  destination: CreativeDestination;
  prompt: string;
  modelId?: string;
  references?: Array<{
    assetId: string;
    uri: string;
    role?: 'image' | 'video' | 'audio' | 'style' | 'product';
  }>;
  brandContext?: Record<string, unknown>;
  audienceContext?: Record<string, unknown>;
  productContext?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type CreativePlan = {
  id: string;
  intentId: string;
  generationRequests: GenerationRequest[];
  strategy?: Record<string, unknown>;
};

export type CreativeJob = {
  id: string;
  intent: CreativeIntent;
  plan: CreativePlan;
  generationJobs: GenerationJob[];
  status: 'queued' | 'running' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
};

export type CreativeGenerationPort = Pick<GenerationService, 'submit'>;

export type CreativeModelResolver = (
  intent: CreativeIntent,
) => GenerationRequest['model'];

export type CreativeEngine = {
  create(intent: CreativeIntent): Promise<CreativeJob>;
};

export class DirectorCreativeEngine implements CreativeEngine {
  constructor(
    private readonly generation: CreativeGenerationPort,
    private readonly resolveModel: CreativeModelResolver,
  ) {}

  async create(intent: CreativeIntent): Promise<CreativeJob> {
    const now = new Date().toISOString();
    const generationRequests = buildGenerationRequests(intent, this.resolveModel(intent));
    const plan: CreativePlan = {
      id: `creative-plan:${intent.id}`,
      intentId: intent.id,
      generationRequests,
      strategy: {
        destination: intent.destination,
        source: intent.source,
      },
    };

    const generationJobs: GenerationJob[] = [];
    for (const request of generationRequests) {
      generationJobs.push(await this.generation.submit(request));
    }

    const status = generationJobs.every((job) => job.status === 'completed')
      ? 'completed'
      : generationJobs.some((job) => job.status === 'failed')
        ? 'failed'
        : 'running';

    return {
      id: `creative:${intent.id}`,
      intent,
      plan,
      generationJobs,
      status,
      createdAt: now,
      updatedAt: new Date().toISOString(),
    };
  }
}

function buildGenerationRequests(
  intent: CreativeIntent,
  model: GenerationRequest['model'],
): GenerationRequest[] {
  return [{
    requestId: `creative-generation:${intent.id}`,
    projectId: intent.id,
    modality: 'image',
    prompt: intent.prompt,
    model,
    parameters: {
      ...(intent.constraints ?? {}),
      destination: intent.destination,
      productContext: intent.productContext,
      brandContext: intent.brandContext,
      audienceContext: intent.audienceContext,
    },
    references: (intent.references ?? []).map((reference) => ({
      assetId: reference.assetId,
      role: 'image' as const,
      uri: reference.uri,
    })),
  }];
}

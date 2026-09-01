import type { GenerationService } from './generation-service';
import type { GenerationRequest } from './generation-provider';

export type CreativeArtRequest = Omit<GenerationRequest, 'modality'> & {
  modality?: 'image';
};

export type CreativeArtResult = {
  generationId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  assetIds: string[];
  error?: string;
};

/**
 * Small application-facing boundary over the existing generation system.
 * Consumers such as storefronts depend on this contract, not providers/models.
 */
export interface CreativeArtProvider {
  generate(request: CreativeArtRequest): Promise<CreativeArtResult>;
  getGenerationStatus(generationId: string): CreativeArtResult | undefined;
  refreshGenerationStatus(generationId: string): Promise<CreativeArtResult>;
}

export class GenerationServiceCreativeArtProvider implements CreativeArtProvider {
  constructor(private readonly generationService: GenerationService) {}

  async generate(request: CreativeArtRequest): Promise<CreativeArtResult> {
    const job = await this.generationService.submit({
      ...request,
      modality: 'image',
    });

    return {
      generationId: job.id,
      status: job.status,
      assetIds: [],
      error: job.error,
    };
  }

  getGenerationStatus(generationId: string): CreativeArtResult | undefined {
    const job = this.generationService.getJob(generationId);
    if (!job) return undefined;

    return {
      generationId: job.id,
      status: job.status,
      assetIds: [],
      error: job.error,
    };
  }

  async refreshGenerationStatus(generationId: string): Promise<CreativeArtResult> {
    const job = await this.generationService.refresh(generationId);
    return {
      generationId: job.id,
      status: job.status,
      assetIds: [],
      error: job.error,
    };
  }
}

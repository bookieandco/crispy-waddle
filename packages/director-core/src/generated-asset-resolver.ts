import type { GenerationResult } from './generation-provider';

export type GeneratedAssetRecord = {
  id: string;
  projectId: string;
  generationJobId: string;
  providerId: string;
  mediaType: 'image' | 'video' | 'audio' | '3d' | 'motion' | 'unknown';
  uri: string;
  mimeType?: string;
  sha256?: string;
  modelId?: string;
  workflowId?: string;
  workflowVersion?: number;
  loras?: Array<{ id: string; weight: number }>;
  prompt?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export interface GeneratedAssetRepository {
  save(asset: GeneratedAssetRecord): Promise<GeneratedAssetRecord>;
  get(id: string): Promise<GeneratedAssetRecord | undefined>;
  listByGenerationJob(generationJobId: string): Promise<GeneratedAssetRecord[]>;
}

export class InMemoryGeneratedAssetRepository implements GeneratedAssetRepository {
  private readonly assets = new Map<string, GeneratedAssetRecord>();

  async save(asset: GeneratedAssetRecord): Promise<GeneratedAssetRecord> {
    this.assets.set(asset.id, asset);
    return asset;
  }

  async get(id: string): Promise<GeneratedAssetRecord | undefined> {
    return this.assets.get(id);
  }

  async listByGenerationJob(generationJobId: string): Promise<GeneratedAssetRecord[]> {
    return [...this.assets.values()].filter((asset) => asset.generationJobId === generationJobId);
  }
}

export type ProviderOutput = {
  uri: string;
  mediaType?: GeneratedAssetRecord['mediaType'];
  mimeType?: string;
  sha256?: string;
  metadata?: Record<string, unknown>;
};

export function resolveGenerationOutputs(
  result: GenerationResult,
  context: Pick<GeneratedAssetRecord, 'projectId' | 'modelId' | 'workflowId' | 'workflowVersion' | 'loras' | 'prompt'>,
  outputs: ProviderOutput[],
): GeneratedAssetRecord[] {
  const createdAt = new Date().toISOString();
  return outputs.map((output, index) => ({
    id: result.assetIds[index] ?? `${result.requestId}:asset:${index + 1}`,
    projectId: context.projectId,
    generationJobId: result.requestId,
    providerId: result.providerId,
    mediaType: output.mediaType ?? 'unknown',
    uri: output.uri,
    mimeType: output.mimeType,
    sha256: output.sha256,
    modelId: context.modelId,
    workflowId: context.workflowId,
    workflowVersion: context.workflowVersion,
    loras: context.loras,
    prompt: context.prompt,
    createdAt,
    metadata: output.metadata,
  }));
}

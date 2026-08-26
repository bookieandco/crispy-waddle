export type GeneratedAssetKind = 'image' | 'video' | 'audio' | '3d' | 'motion';

export type GeneratedAssetRecord = {
  id: string;
  projectId: string;
  generationJobId: string;
  kind: GeneratedAssetKind;
  uri: string;
  mimeType?: string;
  sha256?: string;
  modelId?: string;
  workflowId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

/** Persistence boundary for generated media. Implementations can later target Supabase/object storage. */
export interface GeneratedAssetRepository {
  save(asset: GeneratedAssetRecord): Promise<void>;
  get(id: string): Promise<GeneratedAssetRecord | undefined>;
  listByGenerationJob(generationJobId: string): Promise<GeneratedAssetRecord[]>;
  listByProject(projectId: string): Promise<GeneratedAssetRecord[]>;
}

export class InMemoryGeneratedAssetRepository implements GeneratedAssetRepository {
  private readonly assets = new Map<string, GeneratedAssetRecord>();

  async save(asset: GeneratedAssetRecord): Promise<void> {
    this.assets.set(asset.id, structuredClone(asset));
  }

  async get(id: string): Promise<GeneratedAssetRecord | undefined> {
    const asset = this.assets.get(id);
    return asset ? structuredClone(asset) : undefined;
  }

  async listByGenerationJob(generationJobId: string): Promise<GeneratedAssetRecord[]> {
    return [...this.assets.values()]
      .filter((asset) => asset.generationJobId === generationJobId)
      .map((asset) => structuredClone(asset));
  }

  async listByProject(projectId: string): Promise<GeneratedAssetRecord[]> {
    return [...this.assets.values()]
      .filter((asset) => asset.projectId === projectId)
      .map((asset) => structuredClone(asset));
  }
}

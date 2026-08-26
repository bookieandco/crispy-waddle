export type GenerationModality = 'image' | 'video' | 'audio' | '3d' | 'motion';

export type ProviderCapability =
  | 'text-to-image'
  | 'image-to-image'
  | 'text-to-video'
  | 'image-to-video'
  | 'video-to-video'
  | 'inpainting'
  | 'outpainting'
  | 'upscale'
  | 'motion'
  | 'camera-control';

export type ModelRecord = {
  id: string;
  providerId: string;
  name: string;
  version: string;
  modalities: GenerationModality[];
  capabilities: ProviderCapability[];
  baseModel?: string;
  metadata?: Record<string, unknown>;
};

export type LoRARecord = {
  id: string;
  name: string;
  version: string;
  baseModel: string;
  triggerWords?: string[];
  modalities: GenerationModality[];
  weight: { min: number; max: number; recommended?: number };
  uri?: string;
  sha256?: string;
  license?: string;
  metadata?: Record<string, unknown>;
};

export type GenerationProviderRecord = {
  id: string;
  name: string;
  kind: 'comfyui' | 'api' | 'local' | 'custom';
  endpoint?: string;
  capabilities: ProviderCapability[];
  models: string[];
  health: 'unknown' | 'healthy' | 'degraded' | 'offline';
  metadata?: Record<string, unknown>;
};

export class GenerationRegistry {
  private readonly models = new Map<string, ModelRecord>();
  private readonly loras = new Map<string, LoRARecord>();
  private readonly providers = new Map<string, GenerationProviderRecord>();

  registerModel(model: ModelRecord): void {
    if (this.models.has(model.id)) throw new Error(`Model already registered: ${model.id}`);
    if (!this.providers.has(model.providerId)) throw new Error(`Unknown provider: ${model.providerId}`);
    this.models.set(model.id, structuredClone(model));
  }

  registerLoRA(lora: LoRARecord): void {
    if (this.loras.has(lora.id)) throw new Error(`LoRA already registered: ${lora.id}`);
    if (lora.weight.min < 0 || lora.weight.max > 2 || lora.weight.min > lora.weight.max) {
      throw new Error(`Invalid LoRA weight range: ${lora.id}`);
    }
    this.loras.set(lora.id, structuredClone(lora));
  }

  registerProvider(provider: GenerationProviderRecord): void {
    if (this.providers.has(provider.id)) throw new Error(`Provider already registered: ${provider.id}`);
    this.providers.set(provider.id, structuredClone(provider));
  }

  getModel(id: string): ModelRecord | undefined { return this.models.get(id); }
  getLoRA(id: string): LoRARecord | undefined { return this.loras.get(id); }
  getProvider(id: string): GenerationProviderRecord | undefined { return this.providers.get(id); }

  listModels(): ModelRecord[] { return [...this.models.values()].map(structuredClone); }
  listLoRAs(): LoRARecord[] { return [...this.loras.values()].map(structuredClone); }
  listProviders(): GenerationProviderRecord[] { return [...this.providers.values()].map(structuredClone); }

  compatibleLoRAs(modelId: string): LoRARecord[] {
    const model = this.models.get(modelId);
    if (!model) return [];
    return this.listLoRAs().filter((lora) =>
      lora.baseModel === model.baseModel &&
      lora.modalities.some((modality) => model.modalities.includes(modality)),
    );
  }
}

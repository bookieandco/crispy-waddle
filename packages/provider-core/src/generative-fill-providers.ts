export type GenerativeFillProviderId =
  | 'comfyui-local'
  | 'flux-fill-self-hosted'
  | 'runpod-self-hosted'
  | 'modal-self-hosted'
  | 'fal-flux-fill'
  | 'replicate-inpainting'
  | 'huggingface-inference';

export type ProviderCostModel = 'local' | 'gpu-time' | 'per-output' | 'credits';

export type GenerativeFillProviderConfig = {
  id: GenerativeFillProviderId;
  name: string;
  kind: 'self-hosted' | 'cloud-api';
  costModel: ProviderCostModel;
  capabilities: Array<'inpaint' | 'outpaint' | 'mask-edit' | 'image-to-image'>;
  endpoint?: string;
  credentialRef?: string;
  enabled: boolean;
  commercialUseRequiresLicenseReview?: boolean;
};

/**
 * Provider catalog only. Credentials and endpoints are supplied at runtime.
 * No provider secret belongs in this file or in a .jhadina export.
 */
export const GENERATIVE_FILL_PROVIDERS: GenerativeFillProviderConfig[] = [
  {
    id: 'comfyui-local',
    name: 'ComfyUI (local)',
    kind: 'self-hosted',
    costModel: 'local',
    capabilities: ['inpaint', 'outpaint', 'mask-edit', 'image-to-image'],
    enabled: false,
  },
  {
    id: 'flux-fill-self-hosted',
    name: 'FLUX Fill (self-hosted)',
    kind: 'self-hosted',
    costModel: 'local',
    capabilities: ['inpaint', 'outpaint', 'mask-edit', 'image-to-image'],
    enabled: false,
    commercialUseRequiresLicenseReview: true,
  },
  {
    id: 'runpod-self-hosted',
    name: 'RunPod self-hosted GPU',
    kind: 'self-hosted',
    costModel: 'gpu-time',
    capabilities: ['inpaint', 'outpaint', 'mask-edit', 'image-to-image'],
    enabled: false,
  },
  {
    id: 'modal-self-hosted',
    name: 'Modal self-hosted GPU',
    kind: 'self-hosted',
    costModel: 'gpu-time',
    capabilities: ['inpaint', 'outpaint', 'mask-edit', 'image-to-image'],
    enabled: false,
  },
  {
    id: 'fal-flux-fill',
    name: 'fal.ai FLUX Fill',
    kind: 'cloud-api',
    costModel: 'per-output',
    capabilities: ['inpaint', 'outpaint', 'mask-edit', 'image-to-image'],
    credentialRef: 'FAL_API_KEY',
    enabled: false,
  },
  {
    id: 'replicate-inpainting',
    name: 'Replicate inpainting',
    kind: 'cloud-api',
    costModel: 'per-output',
    capabilities: ['inpaint', 'outpaint', 'mask-edit', 'image-to-image'],
    credentialRef: 'REPLICATE_API_TOKEN',
    enabled: false,
  },
  {
    id: 'huggingface-inference',
    name: 'Hugging Face Inference Providers',
    kind: 'cloud-api',
    costModel: 'credits',
    capabilities: ['inpaint', 'outpaint', 'mask-edit', 'image-to-image'],
    credentialRef: 'HF_TOKEN',
    enabled: false,
  },
];

export type FillRequest = {
  image: string;
  mask: string;
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  width?: number;
  height?: number;
  model?: string;
  metadata?: Record<string, unknown>;
};

export type FillResult = {
  provider: GenerativeFillProviderId;
  assetUri: string;
  thumbnailUri?: string;
  jobId?: string;
  metadata?: Record<string, unknown>;
};

export interface GenerativeFillProvider {
  readonly id: GenerativeFillProviderId;
  generate(request: FillRequest): Promise<FillResult>;
}

export function getGenerativeFillProviders() {
  return GENERATIVE_FILL_PROVIDERS.filter((provider) => provider.enabled);
}

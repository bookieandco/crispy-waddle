import type { GenerationModality, GenerationProviderRecord, LoRARecord, ModelRecord } from './generation-registry';

/**
 * Reference catalog for the external generation ecosystem reviewed for DirectorOS.
 * These records describe capabilities and integration targets; they do not claim
 * that model weights or local ComfyUI workflows are installed.
 */
export const referenceProviders: GenerationProviderRecord[] = [
  {
    id: 'comfyui-local',
    name: 'ComfyUI Local',
    kind: 'comfyui',
    capabilities: ['text-to-image', 'image-to-image', 'text-to-video', 'image-to-video', 'video-to-video', 'inpainting', 'outpainting', 'upscale', 'motion', 'camera-control'],
    models: [],
    health: 'unknown',
    metadata: { source: 'ComfyUI provider boundary' },
  },
];

export const referenceModels: ModelRecord[] = [
  {
    id: 'reference-flux',
    providerId: 'comfyui-local',
    name: 'FLUX',
    version: 'reference',
    modalities: ['image'],
    capabilities: ['text-to-image', 'image-to-image', 'inpainting', 'outpainting'],
    baseModel: 'flux',
    metadata: { status: 'reference-only', sourceFamily: 'loras-dev / Stable Diffusion ecosystem' },
  },
  {
    id: 'reference-sdxl',
    providerId: 'comfyui-local',
    name: 'Stable Diffusion XL',
    version: 'reference',
    modalities: ['image'],
    capabilities: ['text-to-image', 'image-to-image', 'inpainting', 'outpainting', 'upscale'],
    baseModel: 'sdxl',
    metadata: { status: 'reference-only', sourceFamily: 'Stable Diffusion ecosystem' },
  },
  {
    id: 'reference-seva',
    providerId: 'comfyui-local',
    name: 'Stable Virtual Camera',
    version: '1.1',
    modalities: ['image', 'video', '3d'],
    capabilities: ['image-to-image', 'camera-control'],
    baseModel: 'seva-1.1',
    metadata: { status: 'reference-only', licenseGate: 'non-commercial-output-license' },
  },
];

export const referenceLoRAs: LoRARecord[] = [
  {
    id: 'reference-lora-flux',
    name: 'LoRA adapter (FLUX reference)',
    version: 'reference',
    baseModel: 'flux',
    modalities: ['image'],
    weight: { min: 0, max: 2, recommended: 1 },
    metadata: { status: 'reference-only', source: 'loras-dev / TagPilot training workflow' },
  },
  {
    id: 'reference-lora-sdxl',
    name: 'LoRA adapter (SDXL reference)',
    version: 'reference',
    baseModel: 'sdxl',
    modalities: ['image'],
    weight: { min: 0, max: 2, recommended: 1 },
    metadata: { status: 'reference-only', source: 'TagPilot / Stable Diffusion ecosystem' },
  },
];

export const generationCapabilitySources: Record<GenerationModality, string[]> = {
  image: ['loras-dev', 'Stable-Diffusion', 'DirectorsConsole'],
  video: ['DirectorsConsole', 'video-db/Director'],
  audio: ['Stable-Diffusion ecosystem'],
  '3d': ['Stable Virtual Camera', 'ICON', 'EasyMocap', 'Hotham'],
  motion: ['EasyMocap', 'AI4Animation'],
};

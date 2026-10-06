import type { GenerationModality, GenerationProviderRecord, LoRARecord, ModelRecord } from './generation-registry';

/** Reference-only catalog. It records integration targets and licensing metadata; it does not claim weights are installed. */
export const referenceProviders: GenerationProviderRecord[] = [
  {
    id: 'comfyui-local', name: 'ComfyUI Local', kind: 'comfyui',
    capabilities: ['text-to-image', 'image-to-image', 'text-to-video', 'image-to-video', 'video-to-video', 'inpainting', 'outpainting', 'upscale', 'motion', 'camera-control'],
    models: [], health: 'unknown', metadata: { source: 'ComfyUI provider boundary' },
  },
  {
    id: 'musetalk-local', name: 'MuseTalk Local', kind: 'local',
    capabilities: ['video-to-video', 'audio-driven-video', 'lip-sync', 'identity-preserving-video'],
    models: ['reference-musetalk-1.5'], health: 'unknown',
    metadata: {
      status: 'reference-only',
      upstream: 'TMElyralab/MuseTalk',
      codeLicense: 'MIT',
      executionTiers: ['local-homebase', 'gpu-burst'],
      commercialGate: 'verify-model-and-dependency-artifacts',
    },
  },
  {
    id: 'liveportrait-local', name: 'LivePortrait Local', kind: 'local',
    capabilities: ['image-to-video', 'video-to-video', 'portrait-animation', 'motion', 'identity-preserving-video'],
    models: ['reference-liveportrait'], health: 'unknown',
    metadata: {
      status: 'reference-only',
      upstream: 'KlingAIResearch/LivePortrait',
      codeLicense: 'MIT',
      executionTiers: ['local-homebase', 'gpu-burst'],
      commercialGate: 'replace-noncommercial-insightface-detection-models',
    },
  },
  {
    id: 'sadtalker-local', name: 'SadTalker Local', kind: 'local',
    capabilities: ['image-to-video', 'audio-driven-video', 'lip-sync', 'identity-preserving-video'],
    models: ['reference-sadtalker'], health: 'unknown',
    metadata: {
      status: 'reference-only',
      upstream: 'OpenTalker/SadTalker',
      codeLicense: 'Apache-2.0',
      executionTiers: ['local-homebase', 'gpu-burst'],
      commercialGate: 'verify-third-party-model-artifacts',
    },
  },
  {
    id: 'coqui-tts-local', name: 'Coqui TTS Local', kind: 'local',
    capabilities: ['text-to-speech', 'voice-cloning', 'voice-conversion', 'speech-to-speech'],
    models: ['reference-coqui-tts'], health: 'unknown',
    metadata: {
      status: 'reference-only',
      upstream: 'coqui-ai/TTS',
      codeLicense: 'MPL-2.0',
      executionTiers: ['local-homebase', 'gpu-burst'],
      commercialGate: 'model-license-specific',
    },
  },
];

export const referenceModels: ModelRecord[] = [
  { id: 'reference-flux', providerId: 'comfyui-local', name: 'FLUX', version: 'reference', modalities: ['image'], capabilities: ['text-to-image', 'image-to-image', 'inpainting', 'outpainting'], baseModel: 'flux', metadata: { status: 'reference-only', sourceFamily: 'loras-dev / Stable Diffusion ecosystem' } },
  { id: 'reference-sdxl', providerId: 'comfyui-local', name: 'Stable Diffusion XL', version: 'reference', modalities: ['image'], capabilities: ['text-to-image', 'image-to-image', 'inpainting', 'outpainting', 'upscale'], baseModel: 'sdxl', metadata: { status: 'reference-only', sourceFamily: 'Stable Diffusion ecosystem' } },
  { id: 'reference-video', providerId: 'comfyui-local', name: 'ComfyUI Video Generation', version: 'reference', modalities: ['video'], capabilities: ['text-to-video', 'image-to-video', 'video-to-video', 'motion'], baseModel: 'video', metadata: { status: 'reference-only', sourceFamily: 'DirectorsConsole / Stable Diffusion ecosystem' } },
  { id: 'reference-seva', providerId: 'comfyui-local', name: 'Stable Virtual Camera', version: '1.1', modalities: ['image', 'video', '3d'], capabilities: ['image-to-image', 'camera-control'], baseModel: 'seva-1.1', metadata: { status: 'reference-only', licenseGate: 'non-commercial-output-license' } },
  { id: 'reference-easymocap', providerId: 'comfyui-local', name: 'EasyMocap', version: 'reference', modalities: ['motion', '3d'], capabilities: ['motion'], baseModel: 'easymocap', metadata: { status: 'adapter-target', sourceFamily: 'EasyMocap', unsupportedCapabilities: ['motion-capture', 'pose-estimation'] } },
  { id: 'reference-icon', providerId: 'comfyui-local', name: 'ICON', version: 'reference', modalities: ['3d'], capabilities: [], baseModel: 'icon', metadata: { status: 'adapter-target', sourceFamily: 'ICON', unsupportedCapabilities: ['human-reconstruction'] } },
  {
    id: 'reference-musetalk-1.5', providerId: 'musetalk-local', name: 'MuseTalk', version: '1.5',
    modalities: ['video'],
    capabilities: ['video-to-video', 'audio-driven-video', 'lip-sync', 'identity-preserving-video'],
    baseModel: 'musetalk-1.5',
    metadata: { status: 'adapter-target', sourceFamily: 'TMElyralab/MuseTalk', purpose: 'primary local lip-sync and video dubbing' },
  },
  {
    id: 'reference-liveportrait', providerId: 'liveportrait-local', name: 'LivePortrait', version: 'reference',
    modalities: ['video', 'motion'],
    capabilities: ['image-to-video', 'video-to-video', 'portrait-animation', 'motion', 'identity-preserving-video'],
    baseModel: 'liveportrait',
    metadata: { status: 'adapter-target', sourceFamily: 'KlingAIResearch/LivePortrait', purpose: 'portrait motion and expression transfer' },
  },
  {
    id: 'reference-sadtalker', providerId: 'sadtalker-local', name: 'SadTalker', version: '0.0.2',
    modalities: ['video'],
    capabilities: ['image-to-video', 'audio-driven-video', 'lip-sync', 'identity-preserving-video'],
    baseModel: 'sadtalker',
    metadata: { status: 'fallback-adapter-target', sourceFamily: 'OpenTalker/SadTalker', purpose: 'single-image talking-head fallback' },
  },
  {
    id: 'reference-coqui-tts', providerId: 'coqui-tts-local', name: 'Coqui TTS', version: 'reference',
    modalities: ['audio'],
    capabilities: ['text-to-speech', 'voice-cloning', 'voice-conversion', 'speech-to-speech'],
    baseModel: 'coqui-tts',
    metadata: { status: 'adapter-target', sourceFamily: 'coqui-ai/TTS', purpose: 'local speech synthesis and voice transformation', modelLicenseRequired: true },
  },
];

export const referenceLoRAs: LoRARecord[] = [
  { id: 'reference-lora-flux', name: 'LoRA adapter (FLUX reference)', version: 'reference', baseModel: 'flux', modalities: ['image'], weight: { min: 0, max: 2, recommended: 1 }, metadata: { status: 'reference-only', source: 'loras-dev / TagPilot training workflow' } },
  { id: 'reference-lora-sdxl', name: 'LoRA adapter (SDXL reference)', version: 'reference', baseModel: 'sdxl', modalities: ['image'], weight: { min: 0, max: 2, recommended: 1 }, metadata: { status: 'reference-only', source: 'TagPilot / Stable Diffusion ecosystem' } },
  { id: 'reference-character', name: 'Character LoRA', version: 'template', baseModel: 'flux', modalities: ['image', 'video'], weight: { min: 0, max: 1.5, recommended: 0.9 }, metadata: { status: 'template', purpose: 'character identity consistency' } },
  { id: 'reference-style', name: 'Style LoRA', version: 'template', baseModel: 'flux', modalities: ['image', 'video'], weight: { min: 0, max: 1.5, recommended: 0.8 }, metadata: { status: 'template', purpose: 'visual style consistency' } },
];

export const generationCapabilitySources: Record<GenerationModality, string[]> = {
  image: ['loras-dev', 'Stable-Diffusion', 'DirectorsConsole'],
  video: ['DirectorsConsole', 'video-db/Director', 'TMElyralab/MuseTalk', 'KlingAIResearch/LivePortrait', 'OpenTalker/SadTalker'],
  audio: ['Stable-Diffusion ecosystem', 'coqui-ai/TTS'],
  '3d': ['Stable Virtual Camera', 'ICON', 'EasyMocap', 'Hotham'],
  motion: ['EasyMocap', 'AI4Animation', 'KlingAIResearch/LivePortrait'],
  subtitle: [],
};

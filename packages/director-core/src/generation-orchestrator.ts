export type CinematographyPreset = {
  id: string;
  name: string;
  shot?: string;
  angle?: string;
  lens?: string;
  movement?: string;
  framing?: string;
  focus?: string;
  lighting?: string;
  color?: string;
  atmosphere?: string;
  mood?: string;
};

export type ContinuityLock =
  | 'character'
  | 'wardrobe'
  | 'location'
  | 'camera'
  | 'lens'
  | 'lighting'
  | 'composition'
  | 'color'
  | 'performance'
  | 'audio';

export type TakeRequest = {
  projectId: string;
  sceneId: string;
  parentTakeId?: string;
  prompt: string;
  targetRuntimeSeconds?: number;
  sceneCount?: number;
  takeCount?: number;
  locked: ContinuityLock[];
  cinematography?: CinematographyPreset;
  referenceCharacterIds?: string[];
  referenceAssetIds?: string[];
};

export type TakePlan = {
  sceneId: string;
  takeNumber: number;
  parentTakeId?: string;
  continuityLocks: ContinuityLock[];
  prompt: string;
  status: 'queued' | 'generating' | 'review' | 'approved' | 'rejected';
};

/**
 * Converts a natural-language directing request into a non-destructive
 * generation plan. The actual image/video model is deliberately an adapter:
 * DirectorOS owns continuity and approval; providers own generation.
 */
export function planTake(request: TakeRequest): TakePlan {
  return {
    sceneId: request.sceneId,
    takeNumber: (request.takeCount ?? 1),
    parentTakeId: request.parentTakeId,
    continuityLocks: request.locked,
    prompt: request.prompt,
    status: 'queued',
  };
}

export const CINEMATOGRAPHY_PRESETS: CinematographyPreset[] = [
  { id: 'cinematic', name: 'Cinematic', shot: 'medium', lens: '50mm', movement: 'controlled dolly', focus: 'shallow depth', lighting: 'motivated soft key', mood: 'cinematic' },
  { id: 'documentary', name: 'Documentary', shot: 'medium-long', lens: '35mm', movement: 'handheld', framing: 'observational', lighting: 'available light', mood: 'naturalistic' },
  { id: 'noir', name: 'Neo-Noir', shot: 'medium', lens: '50mm', movement: 'slow push-in', lighting: 'hard directional', color: 'high contrast', mood: 'tense' },
  { id: 'comedy', name: 'Comedy', shot: 'medium/two-shot', lens: '35mm', movement: 'restrained', lighting: 'clean readable key', framing: 'performance-first', mood: 'playful' },
  { id: 'music-video', name: 'Music Video', shot: 'varied', lens: '35mm/50mm', movement: 'rhythmic', lighting: 'stylized', color: 'designed palette', mood: 'energetic' },
  { id: 'youtube', name: 'YouTube', shot: 'medium', lens: '35mm/50mm', movement: 'purposeful', lighting: 'clear subject key', framing: 'mobile-friendly', mood: 'direct' },
];

export function buildGenerationBrief(request: TakeRequest) {
  return {
    projectId: request.projectId,
    sceneId: request.sceneId,
    parentTakeId: request.parentTakeId,
    prompt: request.prompt,
    targetRuntimeSeconds: request.targetRuntimeSeconds,
    sceneCount: request.sceneCount,
    takeCount: request.takeCount,
    continuity: {
      locks: request.locked,
      characterReferences: request.referenceCharacterIds ?? [],
      assetReferences: request.referenceAssetIds ?? [],
    },
    cinematography: request.cinematography,
    approvalRequired: true,
  };
}

import { compileDirectorCameraDirective, type DirectorCameraPlan } from './camera-language.js';
import { compilePerformanceDirective, type PerformanceDirectionPlan } from './performance-direction.js';
import { compileRealismDirective, type RealismDirectionPlan } from './realism-direction.js';
import { compileCinematographyLightingDirective, type CinematographyLightingPlan } from './cinematic-lighting.js';
import { compileGenerationReferenceManifest, type GenerationReferenceManifest } from './generation-reference-manifest.js';
import { compileAnimationPrinciplesDirective, type AnimationPrinciplesPlan } from './animation-principles.js';
import { compileContinuityStrategyDirective, type ContinuityStrategyPlan } from './continuity-reference-strategy.js';

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
  /** Stable Director-owned identity for this take; retries must reuse it. */
  takeId: string;
  projectId: string;
  sceneId: string;
  /** Canonical persisted storyboard board; caller supplies an ID, never lineage. */
  storyboardBoardId: string;
  parentTakeId?: string;
  prompt: string;
  targetRuntimeSeconds?: number;
  sceneCount?: number;
  takeCount?: number;
  locked: ContinuityLock[];
  /** Legacy/free-form preset retained for backwards compatibility. */
  cinematography?: CinematographyPreset;
  /** Canonical structured camera intent for new Director camera-aware flows. */
  cameraPlan?: DirectorCameraPlan;
  /** Pre-generation actor/blocking/dialogue direction. */
  performancePlan?: PerformanceDirectionPlan;
  /** Physical plausibility, naturalism and source-preservation direction. */
  realismPlan?: RealismDirectionPlan;
  /** Canonical DP lighting direction, softness, color, intensity and shaping plan. */
  lightingPlan?: CinematographyLightingPlan;
  /** Governed animation motion grammar derived from classical animation principles. */
  animationPlan?: AnimationPrinciplesPlan;
  /** Director-selected cross-shot identity/world continuity strategy. */
  continuityStrategy?: ContinuityStrategyPlan;
  /** Optional exact provider attachment order. When present, adapters must preserve it. */
  referenceManifest?: GenerationReferenceManifest;
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
    prompt: compileTakePrompt(request),
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

export function compileTakePrompt(request: TakeRequest): string {
  const referenceManifest = request.referenceManifest ?? request.continuityStrategy?.referenceManifest;
  const sections = [
    request.prompt.trim(),
    request.cameraPlan ? section('CAMERA DIRECTION', compileDirectorCameraDirective(request.cameraPlan)) : undefined,
    request.performancePlan ? section('PERFORMANCE DIRECTION', compilePerformanceDirective(request.performancePlan)) : undefined,
    request.realismPlan ? section('REALISM / SOURCE PRESERVATION', compileRealismDirective(request.realismPlan)) : undefined,
    request.lightingPlan ? section('CINEMATOGRAPHY LIGHTING', compileCinematographyLightingDirective(request.lightingPlan)) : undefined,
    request.animationPlan ? section('ANIMATION PRINCIPLES', compileAnimationPrinciplesDirective(request.animationPlan)) : undefined,
    request.continuityStrategy ? section('CONTINUITY STRATEGY', compileContinuityStrategyDirective(request.continuityStrategy)) : undefined,
    referenceManifest ? section('REFERENCE MANIFEST', compileGenerationReferenceManifest(referenceManifest).directive) : undefined,
  ].filter((value): value is string => Boolean(value?.trim()));

  return sections.join('\n\n');
}

export function buildGenerationBrief(request: TakeRequest) {
  const referenceManifest = request.referenceManifest ?? request.continuityStrategy?.referenceManifest;
  return {
    takeId: request.takeId,
    projectId: request.projectId,
    sceneId: request.sceneId,
    storyboardBoardId: request.storyboardBoardId,
    parentTakeId: request.parentTakeId,
    prompt: compileTakePrompt(request),
    basePrompt: request.prompt,
    targetRuntimeSeconds: request.targetRuntimeSeconds,
    sceneCount: request.sceneCount,
    takeCount: request.takeCount,
    continuity: {
      locks: request.locked,
      characterReferences: request.referenceCharacterIds ?? [],
      assetReferences: request.referenceAssetIds ?? [],
    },
    cinematography: request.cinematography,
    cameraPlan: request.cameraPlan,
    cameraDirective: request.cameraPlan ? compileDirectorCameraDirective(request.cameraPlan) : undefined,
    performancePlan: request.performancePlan,
    performanceDirective: request.performancePlan ? compilePerformanceDirective(request.performancePlan) : undefined,
    realismPlan: request.realismPlan,
    realismDirective: request.realismPlan ? compileRealismDirective(request.realismPlan) : undefined,
    lightingPlan: request.lightingPlan,
    lightingDirective: request.lightingPlan ? compileCinematographyLightingDirective(request.lightingPlan) : undefined,
    animationPlan: request.animationPlan,
    animationDirective: request.animationPlan ? compileAnimationPrinciplesDirective(request.animationPlan) : undefined,
    continuityStrategy: request.continuityStrategy,
    continuityDirective: request.continuityStrategy ? compileContinuityStrategyDirective(request.continuityStrategy) : undefined,
    referenceManifest,
    referenceDirective: referenceManifest ? compileGenerationReferenceManifest(referenceManifest).directive : undefined,
    approvalRequired: true,
  };
}

function section(title: string, body: string): string {
  return `[${title}]\n${body}`;
}

import type { GrowthId, ISODateTime } from '../domain/types.js';

export type PaidCreativePlatform =
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'reddit'
  | 'linkedin'
  | 'other';

export interface PlatformCreativeProfile {
  id: GrowthId;
  platform: PaidCreativePlatform;
  placement: string;
  allowedAspectRatios: readonly string[];
  defaultAspectRatio: string;
  minimumRuntimeSeconds?: number;
  maximumRuntimeSeconds?: number;
  openingHookDeadlineSeconds?: number;
  captionSafeAreaRef?: string;
  nativeCreativeNotes: readonly string[];
  sourceRefs: readonly string[];
  observedAt: ISODateTime;
  validUntil?: ISODateTime;
  authority: 'PROFILE_ONLY';
}

export interface PlatformCreativeBrief {
  id: GrowthId;
  profileId: GrowthId;
  productIdentityRef: string;
  styleIdentityRef: string;
  bigIdeaRef: string;
  audienceHypothesisRef: string;
  hook: string;
  message: string;
  visualDirection: string;
  callToAction?: string;
  aspectRatio: string;
  targetRuntimeSeconds: number;
  productTruthRefs: readonly string[];
  claimEvidenceRefs: readonly string[];
  evidenceRefs: readonly string[];
  authority: 'PRODUCTION_PLAN_ONLY';
}

export function createPlatformCreativeProfile(
  input: Omit<PlatformCreativeProfile,'authority'>,
): PlatformCreativeProfile {
  if (!input.id.trim() || !input.placement.trim()) throw new Error('GROWTH_PLATFORM_CREATIVE_PROFILE_ID_REQUIRED');
  if (!input.allowedAspectRatios.length) throw new Error('GROWTH_PLATFORM_CREATIVE_ASPECTS_REQUIRED');
  if (!input.allowedAspectRatios.includes(input.defaultAspectRatio)) {
    throw new Error('GROWTH_PLATFORM_CREATIVE_DEFAULT_ASPECT_INVALID');
  }
  if (!input.sourceRefs.length) throw new Error('GROWTH_PLATFORM_CREATIVE_PROFILE_EVIDENCE_REQUIRED');
  if (!Number.isFinite(Date.parse(input.observedAt))) throw new Error('GROWTH_PLATFORM_CREATIVE_PROFILE_OBSERVED_AT_INVALID');
  if (input.validUntil) {
    if (!Number.isFinite(Date.parse(input.validUntil))) throw new Error('GROWTH_PLATFORM_CREATIVE_PROFILE_VALID_UNTIL_INVALID');
    if (Date.parse(input.validUntil) <= Date.parse(input.observedAt)) throw new Error('GROWTH_PLATFORM_CREATIVE_PROFILE_WINDOW_INVALID');
  }
  if (input.minimumRuntimeSeconds !== undefined && (!Number.isFinite(input.minimumRuntimeSeconds) || input.minimumRuntimeSeconds < 0)) {
    throw new Error('GROWTH_PLATFORM_CREATIVE_MIN_RUNTIME_INVALID');
  }
  if (input.maximumRuntimeSeconds !== undefined && (!Number.isFinite(input.maximumRuntimeSeconds) || input.maximumRuntimeSeconds <= 0)) {
    throw new Error('GROWTH_PLATFORM_CREATIVE_MAX_RUNTIME_INVALID');
  }
  if (
    input.minimumRuntimeSeconds !== undefined &&
    input.maximumRuntimeSeconds !== undefined &&
    input.minimumRuntimeSeconds > input.maximumRuntimeSeconds
  ) throw new Error('GROWTH_PLATFORM_CREATIVE_RUNTIME_RANGE_INVALID');
  if (input.openingHookDeadlineSeconds !== undefined && (!Number.isFinite(input.openingHookDeadlineSeconds) || input.openingHookDeadlineSeconds < 0)) {
    throw new Error('GROWTH_PLATFORM_CREATIVE_HOOK_DEADLINE_INVALID');
  }

  return Object.freeze({
    ...input,
    allowedAspectRatios:Object.freeze([...new Set(input.allowedAspectRatios)]),
    nativeCreativeNotes:Object.freeze([...input.nativeCreativeNotes]),
    sourceRefs:Object.freeze([...input.sourceRefs]),
    authority:'PROFILE_ONLY',
  });
}

export function compilePlatformCreativeBrief(input:{
  id:GrowthId;
  profile:PlatformCreativeProfile;
  productIdentityRef:string;
  styleIdentityRef:string;
  bigIdeaRef:string;
  audienceHypothesisRef:string;
  hook:string;
  message:string;
  visualDirection:string;
  callToAction?:string;
  aspectRatio?:string;
  targetRuntimeSeconds:number;
  productTruthRefs:readonly string[];
  claimEvidenceRefs?:readonly string[];
  evidenceRefs:readonly string[];
  asOf?:ISODateTime;
}):PlatformCreativeBrief{
  if (!input.id.trim() || !input.productIdentityRef.trim() || !input.styleIdentityRef.trim()) {
    throw new Error('GROWTH_PLATFORM_CREATIVE_BRIEF_IDENTITY_REQUIRED');
  }
  for (const value of [input.bigIdeaRef,input.audienceHypothesisRef,input.hook,input.message,input.visualDirection]) {
    if (!value.trim()) throw new Error('GROWTH_PLATFORM_CREATIVE_BRIEF_BODY_REQUIRED');
  }
  if (!input.productTruthRefs.length || !input.evidenceRefs.length) {
    throw new Error('GROWTH_PLATFORM_CREATIVE_BRIEF_EVIDENCE_REQUIRED');
  }

  const aspectRatio=input.aspectRatio??input.profile.defaultAspectRatio;
  if (!input.profile.allowedAspectRatios.includes(aspectRatio)) {
    throw new Error('GROWTH_PLATFORM_CREATIVE_ASPECT_NOT_ALLOWED');
  }
  if (!Number.isFinite(input.targetRuntimeSeconds) || input.targetRuntimeSeconds<=0) {
    throw new Error('GROWTH_PLATFORM_CREATIVE_RUNTIME_INVALID');
  }
  if (
    input.profile.minimumRuntimeSeconds!==undefined &&
    input.targetRuntimeSeconds<input.profile.minimumRuntimeSeconds
  ) throw new Error('GROWTH_PLATFORM_CREATIVE_RUNTIME_BELOW_PROFILE');
  if (
    input.profile.maximumRuntimeSeconds!==undefined &&
    input.targetRuntimeSeconds>input.profile.maximumRuntimeSeconds
  ) throw new Error('GROWTH_PLATFORM_CREATIVE_RUNTIME_ABOVE_PROFILE');

  if (input.profile.validUntil && input.asOf) {
    if (!Number.isFinite(Date.parse(input.asOf))) throw new Error('GROWTH_PLATFORM_CREATIVE_AS_OF_INVALID');
    if (Date.parse(input.asOf)>Date.parse(input.profile.validUntil)) {
      throw new Error('GROWTH_PLATFORM_CREATIVE_PROFILE_STALE');
    }
  }

  return Object.freeze({
    id:input.id,
    profileId:input.profile.id,
    productIdentityRef:input.productIdentityRef,
    styleIdentityRef:input.styleIdentityRef,
    bigIdeaRef:input.bigIdeaRef,
    audienceHypothesisRef:input.audienceHypothesisRef,
    hook:input.hook,
    message:input.message,
    visualDirection:input.visualDirection,
    callToAction:input.callToAction,
    aspectRatio,
    targetRuntimeSeconds:input.targetRuntimeSeconds,
    productTruthRefs:Object.freeze([...input.productTruthRefs]),
    claimEvidenceRefs:Object.freeze([...(input.claimEvidenceRefs??[])]),
    evidenceRefs:Object.freeze([...input.evidenceRefs]),
    authority:'PRODUCTION_PLAN_ONLY',
  });
}

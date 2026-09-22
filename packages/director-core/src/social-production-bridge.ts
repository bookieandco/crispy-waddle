import type { GeneratedAssetRecord } from './generated-asset-resolver.js';
import type { MediaReviewDecisionRecord } from './media-review-lifecycle.js';
import type { TakeRequest, ContinuityLock } from './generation-orchestrator.js';

export type SocialProductionMediaType = 'image' | 'video' | 'motion';

export interface DirectorSocialCreativeIdentity {
  productIdentityRef?: string;
  styleIdentityRef?: string;
  platformCreativeProfileRef?: string;
  experimentVariantId?: string;
  mutationAxis?: string;
  fixedDimensionRefs?: Readonly<Record<string,string>>;
}

export interface DirectorSocialProductionBrief {
  id: string;
  sourceSystem: 'social';
  socialContentProjectId: string;
  socialAssetId: string;
  directorProjectId: string;
  intent: string;
  mediaType: SocialProductionMediaType;
  platform?: string;
  aspectRatio?: string;
  targetRuntimeSeconds?: number;
  creativeIdentity?: DirectorSocialCreativeIdentity;
  referenceAssetIds: readonly string[];
  rightsEvidenceRefs: readonly string[];
  evidenceRefs: readonly string[];
  createdAt: string;
  authority: 'PLANNING_ONLY';
  publicationAuthority: 'NONE';
}

export interface CreateDirectorSocialProductionBriefInput {
  id: string;
  socialContentProjectId: string;
  socialAssetId: string;
  directorProjectId: string;
  intent: string;
  mediaType: SocialProductionMediaType;
  platform?: string;
  aspectRatio?: string;
  targetRuntimeSeconds?: number;
  creativeIdentity?: DirectorSocialCreativeIdentity;
  referenceAssetIds?: readonly string[];
  rightsEvidenceRefs?: readonly string[];
  evidenceRefs: readonly string[];
  createdAt: string;
}

export interface DirectorSocialTakeContext {
  storyboardBoardId: string;
  sceneId: string;
  continuityLocks?: readonly ContinuityLock[];
}

export interface DirectorSocialApprovedAssetReceipt {
  id: string;
  briefId: string;
  socialContentProjectId: string;
  socialAssetId: string;
  directorProjectId: string;
  directorAssetId: string;
  generationJobId: string;
  mediaType: GeneratedAssetRecord['mediaType'];
  uri: string;
  mimeType?: string;
  sha256?: string;
  reviewDecisionId: string;
  reviewEvidenceIds: readonly string[];
  approvedAt: string;
  provenance: NonNullable<GeneratedAssetRecord['provenance']>;
  creativeIdentity?: DirectorSocialCreativeIdentity;
  authority: 'DIRECTOR_ASSET_APPROVED';
  publicationAuthority: 'NONE';
}

export function createDirectorSocialProductionBrief(
  input: CreateDirectorSocialProductionBriefInput,
): DirectorSocialProductionBrief {
  nonEmpty(input.id, 'DIRECTOR_SOCIAL_BRIEF_ID_REQUIRED');
  nonEmpty(input.socialContentProjectId, 'DIRECTOR_SOCIAL_PROJECT_ID_REQUIRED');
  nonEmpty(input.socialAssetId, 'DIRECTOR_SOCIAL_ASSET_ID_REQUIRED');
  nonEmpty(input.directorProjectId, 'DIRECTOR_SOCIAL_DIRECTOR_PROJECT_ID_REQUIRED');
  nonEmpty(input.intent, 'DIRECTOR_SOCIAL_INTENT_REQUIRED');
  if (!input.evidenceRefs.length) throw new Error('DIRECTOR_SOCIAL_EVIDENCE_REQUIRED');
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error('DIRECTOR_SOCIAL_CREATED_AT_INVALID');
  if (input.targetRuntimeSeconds !== undefined && (!Number.isFinite(input.targetRuntimeSeconds) || input.targetRuntimeSeconds <= 0)) {
    throw new Error('DIRECTOR_SOCIAL_RUNTIME_INVALID');
  }
  if (input.creativeIdentity) {
    for (const [key,value] of Object.entries(input.creativeIdentity.fixedDimensionRefs ?? {})) {
      if (!key.trim() || !value.trim()) throw new Error('DIRECTOR_SOCIAL_CREATIVE_FIXED_DIMENSION_INVALID');
    }
    for (const value of [
      input.creativeIdentity.productIdentityRef,
      input.creativeIdentity.styleIdentityRef,
      input.creativeIdentity.platformCreativeProfileRef,
      input.creativeIdentity.experimentVariantId,
      input.creativeIdentity.mutationAxis,
    ]) {
      if (value !== undefined && !value.trim()) throw new Error('DIRECTOR_SOCIAL_CREATIVE_IDENTITY_INVALID');
    }
  }

  const refs = [...(input.referenceAssetIds ?? [])];
  const rights = [...(input.rightsEvidenceRefs ?? [])];
  if (refs.length > 0 && rights.length === 0) {
    throw new Error('DIRECTOR_SOCIAL_REFERENCE_RIGHTS_REQUIRED');
  }

  return Object.freeze({
    id: input.id,
    sourceSystem: 'social',
    socialContentProjectId: input.socialContentProjectId,
    socialAssetId: input.socialAssetId,
    directorProjectId: input.directorProjectId,
    intent: input.intent.trim(),
    mediaType: input.mediaType,
    platform: input.platform,
    aspectRatio: input.aspectRatio,
    targetRuntimeSeconds: input.targetRuntimeSeconds,
    creativeIdentity: input.creativeIdentity ? Object.freeze({
      ...input.creativeIdentity,
      fixedDimensionRefs: input.creativeIdentity.fixedDimensionRefs
        ? Object.freeze({ ...input.creativeIdentity.fixedDimensionRefs })
        : undefined,
    }) : undefined,
    referenceAssetIds: Object.freeze(refs),
    rightsEvidenceRefs: Object.freeze(rights),
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    createdAt: input.createdAt,
    authority: 'PLANNING_ONLY',
    publicationAuthority: 'NONE',
  });
}

export function compileDirectorSocialTakeRequest(
  brief: DirectorSocialProductionBrief,
  context: DirectorSocialTakeContext,
): TakeRequest {
  nonEmpty(context.storyboardBoardId, 'DIRECTOR_SOCIAL_STORYBOARD_REQUIRED');
  nonEmpty(context.sceneId, 'DIRECTOR_SOCIAL_SCENE_REQUIRED');

  const takeId = `social:${brief.id}`;
  const requirements = [
    brief.platform ? `target platform: ${brief.platform}` : null,
    brief.aspectRatio ? `aspect ratio: ${brief.aspectRatio}` : null,
    `deliverable: ${brief.mediaType}`,
    brief.creativeIdentity?.productIdentityRef ? `locked product identity: ${brief.creativeIdentity.productIdentityRef}` : null,
    brief.creativeIdentity?.styleIdentityRef ? `locked visual style: ${brief.creativeIdentity.styleIdentityRef}` : null,
    brief.creativeIdentity?.platformCreativeProfileRef ? `platform creative profile: ${brief.creativeIdentity.platformCreativeProfileRef}` : null,
    brief.creativeIdentity?.experimentVariantId ? `experiment variant: ${brief.creativeIdentity.experimentVariantId}` : null,
    brief.creativeIdentity?.mutationAxis ? `only intended creative mutation: ${brief.creativeIdentity.mutationAxis}` : null,
  ].filter(Boolean).join('; ');

  return {
    takeId,
    projectId: brief.directorProjectId,
    sceneId: context.sceneId,
    storyboardBoardId: context.storyboardBoardId,
    prompt: requirements ? `${brief.intent}\n\nProduction requirements: ${requirements}.` : brief.intent,
    targetRuntimeSeconds: brief.targetRuntimeSeconds,
    locked: [...(context.continuityLocks ?? [])],
    referenceAssetIds: [...brief.referenceAssetIds],
    referenceCharacterIds: [],
  };
}

export function expectedDirectorSocialGenerationJobId(
  brief: DirectorSocialProductionBrief,
): string {
  return `director:${brief.directorProjectId}:take:social:${brief.id}`;
}

export function issueDirectorSocialApprovedAssetReceipt(input: {
  receiptId: string;
  brief: DirectorSocialProductionBrief;
  asset: GeneratedAssetRecord;
  review: MediaReviewDecisionRecord;
}): DirectorSocialApprovedAssetReceipt {
  const { brief, asset, review } = input;
  nonEmpty(input.receiptId, 'DIRECTOR_SOCIAL_RECEIPT_ID_REQUIRED');
  if (review.decision !== 'approved') throw new Error('DIRECTOR_SOCIAL_ASSET_NOT_APPROVED');
  if (asset.projectId !== brief.directorProjectId || review.projectId !== brief.directorProjectId) {
    throw new Error('DIRECTOR_SOCIAL_PROJECT_MISMATCH');
  }
  if (review.assetId !== asset.id) throw new Error('DIRECTOR_SOCIAL_REVIEW_ASSET_MISMATCH');
  if (review.generationJobId !== asset.generationJobId) throw new Error('DIRECTOR_SOCIAL_REVIEW_JOB_MISMATCH');
  if (asset.generationJobId !== expectedDirectorSocialGenerationJobId(brief)) {
    throw new Error('DIRECTOR_SOCIAL_BRIEF_JOB_MISMATCH');
  }
  if (!asset.provenance) throw new Error('DIRECTOR_SOCIAL_ASSET_PROVENANCE_REQUIRED');
  if (review.provenance.generationJobId !== asset.provenance.generationJobId) {
    throw new Error('DIRECTOR_SOCIAL_PROVENANCE_MISMATCH');
  }
  if (!review.evidenceIds.length) throw new Error('DIRECTOR_SOCIAL_REVIEW_EVIDENCE_REQUIRED');
  if (!asset.uri.trim()) throw new Error('DIRECTOR_SOCIAL_ASSET_URI_REQUIRED');

  return Object.freeze({
    id: input.receiptId,
    briefId: brief.id,
    socialContentProjectId: brief.socialContentProjectId,
    socialAssetId: brief.socialAssetId,
    directorProjectId: brief.directorProjectId,
    directorAssetId: asset.id,
    generationJobId: asset.generationJobId,
    mediaType: asset.mediaType,
    uri: asset.uri,
    mimeType: asset.mimeType,
    sha256: asset.sha256,
    reviewDecisionId: review.id,
    reviewEvidenceIds: Object.freeze([...review.evidenceIds]),
    approvedAt: review.decidedAt,
    provenance: Object.freeze({ ...asset.provenance, storyboardBoardIds: Object.freeze([...asset.provenance.storyboardBoardIds]) }) as NonNullable<GeneratedAssetRecord['provenance']>,
    creativeIdentity: brief.creativeIdentity ? Object.freeze({
      ...brief.creativeIdentity,
      fixedDimensionRefs: brief.creativeIdentity.fixedDimensionRefs
        ? Object.freeze({ ...brief.creativeIdentity.fixedDimensionRefs })
        : undefined,
    }) : undefined,
    authority: 'DIRECTOR_ASSET_APPROVED',
    publicationAuthority: 'NONE',
  });
}

function nonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

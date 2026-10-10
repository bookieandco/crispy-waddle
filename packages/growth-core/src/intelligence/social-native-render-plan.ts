import type { GrowthId } from '../domain/types.js';
import type { SocialNativeVariantPlan } from './social-juggernaut.js';

export type SocialSourceAssetKind =
  | 'video'
  | 'audio'
  | 'image'
  | 'artwork'
  | 'document'
  | 'text';

export interface SocialSourceAsset {
  id: string;
  kind: SocialSourceAssetKind;
  uri: string;
  rightsEvidenceRefs: readonly string[];
  immutableSourceHash?: string;
}

export type SocialRenderOperation =
  | 'trim'
  | 'stitch'
  | 'aspect_fit'
  | 'caption'
  | 'text_overlay'
  | 'transition'
  | 'safe_frame'
  | 'paginate'
  | 'card_layout'
  | 'image_export'
  | 'thumbnail'
  | 'audio_mux';

export interface SocialNativeRenderPlan {
  id: string;
  subjectId: GrowthId;
  variantId: string;
  platform: string;
  format: SocialNativeVariantPlan['format'];
  path: 'TEXT_ONLY' | 'REPACKAGE_EXISTING' | 'DIRECTOR_CREATE';
  sourceAssetIds: readonly string[];
  operations: readonly SocialRenderOperation[];
  sourceSafe: true;
  preserveSourceHashes: true;
  noVoiceCloneWithoutSeparateIdentityAuthority: true;
  noArtworkRestyleWithoutSeparateCreativeAuthority: true;
  requiresDirectorReview: boolean;
  evidenceRefs: readonly string[];
  authority: 'PRODUCTION_PLANNING_ONLY';
  publicationAuthority: 'NONE';
}

export function compileSocialNativeRenderPlan(input: {
  variant: SocialNativeVariantPlan;
  sourceAssets?: readonly SocialSourceAsset[];
  evidenceRefs: readonly string[];
}): SocialNativeRenderPlan {
  if (!input.evidenceRefs.length) {
    throw new Error('SOCIAL_RENDER_EVIDENCE_REQUIRED');
  }
  const assets = input.sourceAssets ?? [];
  assets.forEach(validateAsset);

  const operations = operationsFor(input.variant.format);
  const textOnly = operations.length === 0;
  const reusable = !textOnly && canReuse(input.variant.format, assets);
  const path: SocialNativeRenderPlan['path'] = textOnly
    ? 'TEXT_ONLY'
    : reusable
      ? 'REPACKAGE_EXISTING'
      : 'DIRECTOR_CREATE';

  return Object.freeze({
    id: `social-render:${safe(input.variant.id)}`,
    subjectId: input.variant.subjectId,
    variantId: input.variant.id,
    platform: input.variant.platform,
    format: input.variant.format,
    path,
    sourceAssetIds: Object.freeze(assets.map((asset) => asset.id)),
    operations: Object.freeze(operations),
    sourceSafe: true as const,
    preserveSourceHashes: true as const,
    noVoiceCloneWithoutSeparateIdentityAuthority: true as const,
    noArtworkRestyleWithoutSeparateCreativeAuthority: true as const,
    requiresDirectorReview: !textOnly,
    evidenceRefs: Object.freeze(unique([
      ...input.evidenceRefs,
      ...input.variant.evidenceRefs,
      ...assets.flatMap((asset) => asset.rightsEvidenceRefs),
      ...assets.flatMap((asset) => asset.immutableSourceHash
        ? [`source-hash:${asset.immutableSourceHash}`]
        : []),
    ])),
    authority: 'PRODUCTION_PLANNING_ONLY' as const,
    publicationAuthority: 'NONE' as const,
  });
}

function operationsFor(
  format: SocialNativeVariantPlan['format'],
): SocialRenderOperation[] {
  switch (format) {
    case 'short_video':
      return ['trim', 'stitch', 'aspect_fit', 'caption', 'text_overlay', 'transition', 'audio_mux', 'thumbnail'];
    case 'long_video':
      return ['trim', 'stitch', 'aspect_fit', 'caption', 'text_overlay', 'transition', 'audio_mux', 'thumbnail'];
    case 'carousel':
      return ['safe_frame', 'paginate', 'card_layout', 'image_export'];
    case 'pin':
      return ['safe_frame', 'card_layout', 'image_export'];
    case 'image':
      return ['safe_frame', 'image_export'];
    case 'story':
      return ['safe_frame', 'aspect_fit', 'text_overlay', 'image_export'];
    case 'text_post':
    case 'thread':
    case 'discussion':
      return [];
  }
}

function canReuse(
  format: SocialNativeVariantPlan['format'],
  assets: readonly SocialSourceAsset[],
): boolean {
  switch (format) {
    case 'short_video':
    case 'long_video':
      return assets.some((asset) => asset.kind === 'video');
    case 'carousel':
    case 'pin':
    case 'image':
    case 'story':
      return assets.some((asset) => ['image', 'artwork', 'document'].includes(asset.kind));
    case 'text_post':
    case 'thread':
    case 'discussion':
      return true;
  }
}

function validateAsset(asset: SocialSourceAsset): void {
  if (!asset.id.trim() || !asset.uri.trim()) {
    throw new Error('SOCIAL_RENDER_SOURCE_ASSET_INVALID');
  }
  if (asset.kind !== 'text' && !asset.rightsEvidenceRefs.length) {
    throw new Error('SOCIAL_RENDER_SOURCE_RIGHTS_REQUIRED');
  }
  if (asset.immutableSourceHash !== undefined && !asset.immutableSourceHash.trim()) {
    throw new Error('SOCIAL_RENDER_SOURCE_HASH_INVALID');
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function safe(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]+/g, '-').slice(0, 160);
}

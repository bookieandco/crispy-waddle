export type CommercialBatchAudioMode = "silent" | "generated" | "post_add";
export type CommercialBatchAspectRatio = "9:16" | "1:1" | "4:5";

export interface CommercialReferencePattern {
  id: string;
  sourceRef: string;
  evidenceIds: readonly string[];
  /**
   * Abstract creative mechanics only. Do not encode a frame-by-frame copy of
   * another creator's protected expression.
   */
  hookClass: string;
  framing: readonly string[];
  motionLanguage: readonly string[];
  pacingNotes: readonly string[];
  productDemonstrationPattern: readonly string[];
  callToActionClass?: string;
}

export interface CommercialBatchGenerationItem {
  id: string;
  productRef: string;
  productTruthLockRef: string;
  productReferenceAssetIds: readonly string[];
  rightsEvidenceIds: readonly string[];
  variationNotes: readonly string[];
}

export interface CommercialBatchGenerationPlan {
  id: string;
  projectId: string;
  platform: "tiktok" | "instagram-reels" | "youtube-shorts" | "other";
  items: readonly CommercialBatchGenerationItem[];
  referencePattern: CommercialReferencePattern;
  characterRef?: string;
  characterRightsEvidenceIds?: readonly string[];
  durationSeconds: number;
  aspectRatio: CommercialBatchAspectRatio;
  audioMode: CommercialBatchAudioMode;
  providerCandidateIds: readonly string[];
  maxItemsPerProviderBatch: number;
  maxEstimatedCredits?: number;
  estimatedCreditsPerItem?: number;
  publicationAuthority: "NO_PUBLISH_AUTHORITY";
}

export interface CommercialBatchChunk {
  chunkId: string;
  itemIds: readonly string[];
  estimatedCredits?: number;
}

export function planCommercialBatchChunks(
  plan: CommercialBatchGenerationPlan,
): readonly CommercialBatchChunk[] {
  assertCommercialBatchGenerationPlan(plan);

  const chunks: CommercialBatchChunk[] = [];
  for (let start = 0; start < plan.items.length; start += plan.maxItemsPerProviderBatch) {
    const items = plan.items.slice(start, start + plan.maxItemsPerProviderBatch);
    const estimatedCredits =
      plan.estimatedCreditsPerItem === undefined
        ? undefined
        : items.length * plan.estimatedCreditsPerItem;

    chunks.push(
      Object.freeze({
        chunkId: `${plan.id}:chunk:${Math.floor(start / plan.maxItemsPerProviderBatch) + 1}`,
        itemIds: Object.freeze(items.map((item) => item.id)),
        estimatedCredits,
      }),
    );
  }

  if (
    plan.maxEstimatedCredits !== undefined &&
    chunks.reduce((sum, chunk) => sum + (chunk.estimatedCredits ?? 0), 0) >
      plan.maxEstimatedCredits
  ) {
    throw new Error("DIRECTOR_COMMERCIAL_BATCH_CREDIT_BUDGET_EXCEEDED");
  }

  return Object.freeze(chunks);
}

export function assertCommercialBatchGenerationPlan(
  plan: CommercialBatchGenerationPlan,
): void {
  if (!plan.id.trim() || !plan.projectId.trim()) {
    throw new Error("DIRECTOR_COMMERCIAL_BATCH_IDENTITY_REQUIRED");
  }
  if (!plan.items.length) throw new Error("DIRECTOR_COMMERCIAL_BATCH_ITEMS_REQUIRED");
  if (!plan.providerCandidateIds.length) {
    throw new Error("DIRECTOR_COMMERCIAL_BATCH_PROVIDER_REQUIRED");
  }
  if (
    !Number.isInteger(plan.maxItemsPerProviderBatch) ||
    plan.maxItemsPerProviderBatch < 1 ||
    plan.maxItemsPerProviderBatch > 100
  ) {
    throw new Error("DIRECTOR_COMMERCIAL_BATCH_SIZE_INVALID");
  }
  if (
    !Number.isFinite(plan.durationSeconds) ||
    plan.durationSeconds <= 0 ||
    plan.durationSeconds > 60
  ) {
    throw new Error("DIRECTOR_COMMERCIAL_BATCH_DURATION_INVALID");
  }
  if (
    plan.estimatedCreditsPerItem !== undefined &&
    (!Number.isFinite(plan.estimatedCreditsPerItem) ||
      plan.estimatedCreditsPerItem < 0)
  ) {
    throw new Error("DIRECTOR_COMMERCIAL_BATCH_CREDIT_ESTIMATE_INVALID");
  }
  if (
    plan.maxEstimatedCredits !== undefined &&
    (!Number.isFinite(plan.maxEstimatedCredits) || plan.maxEstimatedCredits < 0)
  ) {
    throw new Error("DIRECTOR_COMMERCIAL_BATCH_CREDIT_BUDGET_INVALID");
  }
  if (plan.publicationAuthority !== "NO_PUBLISH_AUTHORITY") {
    throw new Error("DIRECTOR_COMMERCIAL_BATCH_CANNOT_PUBLISH");
  }

  assertReferencePattern(plan.referencePattern);

  const itemIds = new Set<string>();
  for (const item of plan.items) {
    if (
      !item.id.trim() ||
      !item.productRef.trim() ||
      !item.productTruthLockRef.trim()
    ) {
      throw new Error("DIRECTOR_COMMERCIAL_BATCH_ITEM_IDENTITY_REQUIRED");
    }
    if (itemIds.has(item.id)) {
      throw new Error("DIRECTOR_COMMERCIAL_BATCH_DUPLICATE_ITEM");
    }
    itemIds.add(item.id);
    if (!item.productReferenceAssetIds.length) {
      throw new Error("DIRECTOR_COMMERCIAL_BATCH_PRODUCT_REFERENCE_REQUIRED");
    }
    if (!item.rightsEvidenceIds.length) {
      throw new Error("DIRECTOR_COMMERCIAL_BATCH_RIGHTS_EVIDENCE_REQUIRED");
    }
  }

  if (plan.characterRef && !plan.characterRightsEvidenceIds?.length) {
    throw new Error("DIRECTOR_COMMERCIAL_BATCH_CHARACTER_RIGHTS_REQUIRED");
  }
}

function assertReferencePattern(pattern: CommercialReferencePattern): void {
  if (!pattern.id.trim() || !pattern.sourceRef.trim()) {
    throw new Error("DIRECTOR_COMMERCIAL_PATTERN_IDENTITY_REQUIRED");
  }
  if (!pattern.evidenceIds.length) {
    throw new Error("DIRECTOR_COMMERCIAL_PATTERN_EVIDENCE_REQUIRED");
  }
  if (!pattern.hookClass.trim()) {
    throw new Error("DIRECTOR_COMMERCIAL_PATTERN_HOOK_REQUIRED");
  }
  if (
    !pattern.framing.length ||
    !pattern.motionLanguage.length ||
    !pattern.productDemonstrationPattern.length
  ) {
    throw new Error("DIRECTOR_COMMERCIAL_PATTERN_MECHANICS_REQUIRED");
  }
}

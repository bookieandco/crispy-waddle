/** Explicit human/real-runtime evidence. A pixel-size check cannot establish pet likeness. */
export type CreativeCanaryReceipt = {
  schema: 'jhadina.local-creative-canary.v1';
  engine: 'comfyui-local';
  observedAt: string;
  modelId: string;
  checkpointSha256: string;
  workflowSha256: string;
  referenceSha256s: readonly string[];
  elapsedMs: number;
  runWasExecuted: boolean;
  localOnlyEndpoint: boolean;
  checkpointCommercialRightsOperatorAttested: boolean;
  output: { sha256: string; width: number; height: number; bytes: number; format: string; hasTransparency: boolean };
  petIdentityVerified: boolean;
  humanPrintReviewPassed: boolean;
};

export type CreativeAcceptanceResult = { pass: boolean; reasons: readonly string[] };

const hash = (value:string) => /^[0-9a-f]{64}$/i.test(value);
export function validateLocalImageCanary(
  receipt: CreativeCanaryReceipt | undefined,
  options: { maximumElapsedMs: number; expectTransparency?: boolean; requireCommercialUse: boolean },
): CreativeAcceptanceResult {
  const reasons: string[] = [];
  if (!receipt || receipt.schema !== 'jhadina.local-creative-canary.v1' || !receipt.runWasExecuted || !receipt.localOnlyEndpoint)
    reasons.push('LOCAL_COMFYUI_REAL_EXECUTION_NOT_PROVEN');
  if (!receipt || !hash(receipt.checkpointSha256) || !hash(receipt.workflowSha256) ||
    !receipt.modelId.trim()) reasons.push('LOCAL_MODEL_WORKFLOW_PIN_NOT_PROVEN');
  if (!receipt || !receipt.referenceSha256s.length ||
    receipt.referenceSha256s.some((ref) => !hash(ref)))
    reasons.push('REAL_REFERENCE_HASHES_REQUIRED');
  if (!receipt || !hash(receipt.output.sha256) || receipt.output.width < 512 ||
    receipt.output.height < 512 || receipt.output.bytes < 1 ||
    !['PNG','JPEG','WEBP'].includes(receipt.output.format))
    reasons.push('REAL_IMAGE_OUTPUT_NOT_PROVEN');
  if (receipt && (!Number.isFinite(receipt.elapsedMs) || receipt.elapsedMs <= 0 ||
    receipt.elapsedMs > options.maximumElapsedMs))
    reasons.push('LOCAL_IMAGE_LATENCY_NOT_ACCEPTED');
  if (options.expectTransparency && !receipt?.output.hasTransparency)
    reasons.push('TRANSPARENCY_NOT_PROVEN');
  if (options.requireCommercialUse && !receipt?.checkpointCommercialRightsOperatorAttested)
    reasons.push('MODEL_COMMERCIAL_RIGHTS_NOT_ATTESTED');
  return {pass:reasons.length === 0,reasons};
}

export type PetIdentityVisualReview = {
  /** Identity source/photo and resulting artwork must be hash-linked. */
  referenceSha256s: readonly string[];
  outputSha256: string;
  reviewerId: string;
  reviewedAt: string;
  petMarkingsMatch: boolean;
  eyesAndEarsMatch: boolean;
  edgeAndAlphaReviewed: boolean;
  printMasterVariantReviewed: boolean;
  printLayoutGatePassed: boolean;
  customerArtworkApproved: boolean;
};

export function validatePetPortraitRelease(
  receipt: CreativeCanaryReceipt | undefined,
  review: PetIdentityVisualReview | undefined,
): CreativeAcceptanceResult {
  const result=validateLocalImageCanary(receipt,{maximumElapsedMs:90000,requireCommercialUse:true});
  const reasons=[...result.reasons];
  if (!receipt || !review || !hash(review.outputSha256) ||
    review.outputSha256 !== receipt.output.sha256 ||
    !review.referenceSha256s.length ||
    review.referenceSha256s.join('|') !== receipt.referenceSha256s.join('|') ||
    !review.reviewerId.trim() || !Number.isFinite(Date.parse(review.reviewedAt)))
    reasons.push('HUMAN_VISUAL_REVIEW_PROVENANCE_REQUIRED');
  if (!review?.petMarkingsMatch || !review?.eyesAndEarsMatch)
    reasons.push('PET_LIKENESS_NOT_HUMAN_VERIFIED');
  if (!review?.edgeAndAlphaReviewed) reasons.push('ARTWORK_EDGES_NOT_REVIEWED');
  if (!review?.printMasterVariantReviewed || !review?.printLayoutGatePassed)
    reasons.push('PRODUCT_VARIANT_PRINT_MASTER_NOT_ACCEPTED');
  if (!review?.customerArtworkApproved)
    reasons.push('CUSTOMER_ARTWORK_APPROVAL_REQUIRED');
  return {pass:reasons.length===0,reasons};
}

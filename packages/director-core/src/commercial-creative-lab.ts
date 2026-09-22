export type CommercialPlatform =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'facebook'
  | 'reddit'
  | 'linkedin'
  | 'other';

export type CommercialHookType =
  | 'scroll-stopper'
  | 'problem-solution'
  | 'story'
  | 'comedy'
  | 'demonstration'
  | 'testimonial'
  | 'feature-benefit'
  | 'comparison'
  | 'curiosity';

export interface ProductLabelAuthority {
  id: string;
  assetId: string;
  sha256: string;
  text: string;
  surface: 'front' | 'back' | 'side' | 'top' | 'bottom' | 'detail';
  evidenceIds: readonly string[];
}

export interface ProductReferenceView {
  id: string;
  assetId: string;
  sha256: string;
  view: 'hero' | 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'detail' | 'in-use';
  evidenceIds: readonly string[];
}

export interface ProductIdentityBible {
  id: string;
  projectId: string;
  productId: string;
  displayName: string;
  canonicalVariantId: string;
  referenceViews: readonly ProductReferenceView[];
  labelAuthorities: readonly ProductLabelAuthority[];
  immutableTraits: readonly string[];
  dimensions?: { width: number; height: number; depth: number; unit: 'mm' | 'cm' | 'in' };
  claimEvidenceIds: readonly string[];
  rightsEvidenceIds: readonly string[];
}

export interface VisualStyleBible {
  id: string;
  projectId: string;
  referenceAssetIds: readonly string[];
  referenceSha256s: readonly string[];
  styleBlock: string;
  lightingRules: readonly string[];
  paletteRules: readonly string[];
  lensAndCameraRules: readonly string[];
  textureRules: readonly string[];
  forbiddenDrift: readonly string[];
  evidenceIds: readonly string[];
}

export interface CommercialCreativeBeat {
  startSeconds: number;
  endSeconds: number;
  purpose: 'hook' | 'setup' | 'demonstration' | 'proof' | 'payoff' | 'cta';
  action: string;
  productRequired: boolean;
}

export interface CommercialCreativeConcept {
  id: string;
  projectId: string;
  productBibleId: string;
  styleBibleId: string;
  platform: CommercialPlatform;
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';
  targetRuntimeSeconds: number;
  hookType: CommercialHookType;
  bigIdeaRef: string;
  audienceHypothesisRef: string;
  offerRef?: string;
  concept: string;
  benefitClaimRefs: readonly string[];
  beats: readonly CommercialCreativeBeat[];
  evidenceIds: readonly string[];
  authority: 'CREATIVE_PLAN_ONLY';
}

export type AdMutationAxis =
  | 'product-variant'
  | 'character'
  | 'hook'
  | 'opening-shot'
  | 'cta'
  | 'platform-format'
  | 'visual-treatment';

export interface AdMultiplierVariant {
  id: string;
  parentCreativeId: string;
  mutationAxis: AdMutationAxis;
  replacementRef: string;
  replacementEvidenceIds: readonly string[];
  replacementRightsEvidenceIds: readonly string[];
  preserveProductIdentity: boolean;
  preserveCharacterIdentity: boolean;
  preserveStoryStructure: boolean;
}

export interface AdMultiplierPlan {
  id: string;
  projectId: string;
  sourceCreativeId: string;
  variants: readonly AdMultiplierVariant[];
  experimentIsolation: 'single-axis' | 'multi-axis-exploratory';
  authority: 'PRODUCTION_PLAN_ONLY';
}

export interface CommercialCreativeQcObservation {
  creativeId: string;
  productIdentityScore: number;
  labelAccuracyScore: number;
  styleContinuityScore: number;
  storyClarityScore: number;
  hookClarityScore: number;
  benefitSupportScore: number;
  visualArtifactScore: number;
  evidenceIds: readonly string[];
}

export interface CommercialCreativeQcDecision {
  admissible: boolean;
  score: number;
  reasons: readonly string[];
}

function score01(value: number, code: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(code);
}

export function validateProductIdentityBible(bible: ProductIdentityBible): readonly string[] {
  const reasons: string[] = [];
  if (!bible.id.trim() || !bible.projectId.trim() || !bible.productId.trim() || !bible.displayName.trim()) {
    reasons.push('DIRECTOR_AD_PRODUCT_IDENTITY_REQUIRED');
  }
  if (!bible.referenceViews.length) reasons.push('DIRECTOR_AD_PRODUCT_REFERENCE_REQUIRED');
  if (!bible.immutableTraits.length) reasons.push('DIRECTOR_AD_PRODUCT_TRAITS_REQUIRED');
  if (!bible.rightsEvidenceIds.length) reasons.push('DIRECTOR_AD_PRODUCT_RIGHTS_REQUIRED');
  for (const view of bible.referenceViews) {
    if (!view.assetId.trim() || !view.sha256.trim() || !view.evidenceIds.length) {
      reasons.push(`DIRECTOR_AD_PRODUCT_VIEW_INVALID:${view.id}`);
    }
  }
  for (const label of bible.labelAuthorities) {
    if (!label.assetId.trim() || !label.sha256.trim() || !label.text.trim() || !label.evidenceIds.length) {
      reasons.push(`DIRECTOR_AD_LABEL_AUTHORITY_INVALID:${label.id}`);
    }
  }
  if (bible.dimensions && [bible.dimensions.width,bible.dimensions.height,bible.dimensions.depth].some(value => !Number.isFinite(value) || value <= 0)) {
    reasons.push('DIRECTOR_AD_PRODUCT_DIMENSIONS_INVALID');
  }
  return Object.freeze([...new Set(reasons)]);
}

export function validateVisualStyleBible(bible: VisualStyleBible): readonly string[] {
  const reasons: string[] = [];
  if (!bible.id.trim() || !bible.projectId.trim() || !bible.styleBlock.trim()) {
    reasons.push('DIRECTOR_AD_STYLE_IDENTITY_REQUIRED');
  }
  if (!bible.referenceAssetIds.length || bible.referenceAssetIds.length !== bible.referenceSha256s.length) {
    reasons.push('DIRECTOR_AD_STYLE_REFERENCES_INVALID');
  }
  if (!bible.evidenceIds.length) reasons.push('DIRECTOR_AD_STYLE_EVIDENCE_REQUIRED');
  return Object.freeze(reasons);
}

export function createCommercialCreativeConcept(input: Omit<CommercialCreativeConcept,'authority'>): CommercialCreativeConcept {
  if (!input.id.trim() || !input.projectId.trim() || !input.productBibleId.trim() || !input.styleBibleId.trim()) {
    throw new Error('DIRECTOR_AD_CONCEPT_IDENTITY_REQUIRED');
  }
  if (!input.bigIdeaRef.trim() || !input.audienceHypothesisRef.trim() || !input.concept.trim()) {
    throw new Error('DIRECTOR_AD_CONCEPT_STRATEGY_REQUIRED');
  }
  if (!Number.isFinite(input.targetRuntimeSeconds) || input.targetRuntimeSeconds <= 0 || input.targetRuntimeSeconds > 300) {
    throw new Error('DIRECTOR_AD_RUNTIME_INVALID');
  }
  if (!input.evidenceIds.length) throw new Error('DIRECTOR_AD_CONCEPT_EVIDENCE_REQUIRED');
  if (!input.beats.length) throw new Error('DIRECTOR_AD_BEATS_REQUIRED');

  const beats = [...input.beats].sort((a,b) => a.startSeconds-b.startSeconds);
  let previousEnd = 0;
  for (const beat of beats) {
    if (
      !Number.isFinite(beat.startSeconds) ||
      !Number.isFinite(beat.endSeconds) ||
      beat.startSeconds < 0 ||
      beat.endSeconds <= beat.startSeconds ||
      beat.endSeconds > input.targetRuntimeSeconds + 1e-6
    ) throw new Error('DIRECTOR_AD_BEAT_TIMING_INVALID');
    if (beat.startSeconds < previousEnd - 1e-6) throw new Error('DIRECTOR_AD_BEAT_OVERLAP');
    if (!beat.action.trim()) throw new Error('DIRECTOR_AD_BEAT_ACTION_REQUIRED');
    previousEnd = beat.endSeconds;
  }

  const first = beats[0]!;
  if (first.purpose !== 'hook' || first.startSeconds > 0.25) {
    throw new Error('DIRECTOR_AD_OPENING_HOOK_REQUIRED');
  }

  return Object.freeze({
    ...input,
    beats: Object.freeze(beats.map(beat => Object.freeze({...beat}))),
    benefitClaimRefs: Object.freeze([...input.benefitClaimRefs]),
    evidenceIds: Object.freeze([...input.evidenceIds]),
    authority: 'CREATIVE_PLAN_ONLY',
  });
}

export function createAdMultiplierPlan(input: Omit<AdMultiplierPlan,'authority'>): AdMultiplierPlan {
  if (!input.id.trim() || !input.projectId.trim() || !input.sourceCreativeId.trim()) {
    throw new Error('DIRECTOR_AD_MULTIPLIER_IDENTITY_REQUIRED');
  }
  if (!input.variants.length) throw new Error('DIRECTOR_AD_MULTIPLIER_VARIANTS_REQUIRED');
  const ids = new Set<string>();
  for (const variant of input.variants) {
    if (!variant.id.trim() || !variant.parentCreativeId.trim() || !variant.replacementRef.trim()) {
      throw new Error('DIRECTOR_AD_MULTIPLIER_VARIANT_INVALID');
    }
    if (variant.parentCreativeId !== input.sourceCreativeId) {
      throw new Error('DIRECTOR_AD_MULTIPLIER_PARENT_MISMATCH');
    }
    if (ids.has(variant.id)) throw new Error('DIRECTOR_AD_MULTIPLIER_VARIANT_DUPLICATE');
    ids.add(variant.id);
    if (!variant.replacementEvidenceIds.length) throw new Error('DIRECTOR_AD_MULTIPLIER_EVIDENCE_REQUIRED');
    if ((variant.mutationAxis === 'product-variant' || variant.mutationAxis === 'character') && !variant.replacementRightsEvidenceIds.length) {
      throw new Error('DIRECTOR_AD_MULTIPLIER_REPLACEMENT_RIGHTS_REQUIRED');
    }
    if (variant.mutationAxis === 'product-variant' && !variant.preserveProductIdentity) {
      throw new Error('DIRECTOR_AD_MULTIPLIER_PRODUCT_IDENTITY_REQUIRED');
    }
    if (variant.mutationAxis === 'character' && !variant.preserveCharacterIdentity) {
      throw new Error('DIRECTOR_AD_MULTIPLIER_CHARACTER_IDENTITY_REQUIRED');
    }
  }
  if (input.experimentIsolation === 'single-axis') {
    const axes = new Set(input.variants.map(variant => variant.mutationAxis));
    if (axes.size !== 1) throw new Error('DIRECTOR_AD_EXPERIMENT_SINGLE_AXIS_REQUIRED');
  }
  return Object.freeze({
    ...input,
    variants: Object.freeze(input.variants.map(variant => Object.freeze({
      ...variant,
      replacementEvidenceIds: Object.freeze([...variant.replacementEvidenceIds]),
      replacementRightsEvidenceIds: Object.freeze([...variant.replacementRightsEvidenceIds]),
    }))),
    authority: 'PRODUCTION_PLAN_ONLY',
  });
}

export function evaluateCommercialCreativeQc(
  observation: CommercialCreativeQcObservation,
  policy: {
    minimumProductIdentity: number;
    minimumLabelAccuracy: number;
    minimumStyleContinuity: number;
    minimumStoryClarity: number;
    minimumHookClarity: number;
    minimumBenefitSupport: number;
    maximumVisualArtifact: number;
  },
): CommercialCreativeQcDecision {
  const metrics: Array<[number,string]> = [
    [observation.productIdentityScore,'DIRECTOR_AD_QC_PRODUCT_IDENTITY_INVALID'],
    [observation.labelAccuracyScore,'DIRECTOR_AD_QC_LABEL_ACCURACY_INVALID'],
    [observation.styleContinuityScore,'DIRECTOR_AD_QC_STYLE_INVALID'],
    [observation.storyClarityScore,'DIRECTOR_AD_QC_STORY_INVALID'],
    [observation.hookClarityScore,'DIRECTOR_AD_QC_HOOK_INVALID'],
    [observation.benefitSupportScore,'DIRECTOR_AD_QC_BENEFIT_INVALID'],
    [observation.visualArtifactScore,'DIRECTOR_AD_QC_ARTIFACT_INVALID'],
  ];
  for (const [value,code] of metrics) score01(value,code);

  const reasons: string[] = [];
  if (!observation.evidenceIds.length) reasons.push('DIRECTOR_AD_QC_EVIDENCE_REQUIRED');
  if (observation.productIdentityScore < policy.minimumProductIdentity) reasons.push('DIRECTOR_AD_PRODUCT_IDENTITY_DRIFT');
  if (observation.labelAccuracyScore < policy.minimumLabelAccuracy) reasons.push('DIRECTOR_AD_LABEL_DRIFT');
  if (observation.styleContinuityScore < policy.minimumStyleContinuity) reasons.push('DIRECTOR_AD_STYLE_DRIFT');
  if (observation.storyClarityScore < policy.minimumStoryClarity) reasons.push('DIRECTOR_AD_STORY_UNCLEAR');
  if (observation.hookClarityScore < policy.minimumHookClarity) reasons.push('DIRECTOR_AD_HOOK_WEAK');
  if (observation.benefitSupportScore < policy.minimumBenefitSupport) reasons.push('DIRECTOR_AD_BENEFIT_UNSUPPORTED');
  if (observation.visualArtifactScore > policy.maximumVisualArtifact) reasons.push('DIRECTOR_AD_VISUAL_ARTIFACTS_HIGH');

  const score =
    observation.productIdentityScore * 0.22 +
    observation.labelAccuracyScore * 0.18 +
    observation.styleContinuityScore * 0.12 +
    observation.storyClarityScore * 0.16 +
    observation.hookClarityScore * 0.16 +
    observation.benefitSupportScore * 0.16 -
    observation.visualArtifactScore * 0.1;

  return Object.freeze({
    admissible: reasons.length === 0,
    score: Math.max(0,Math.min(1,score)),
    reasons: Object.freeze(reasons),
  });
}

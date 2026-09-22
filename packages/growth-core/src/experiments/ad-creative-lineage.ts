import type { GrowthId, ISODateTime } from '../domain/types.js';
import type { BinaryCreativeExperiment } from './creative-ab-experiment.js';

export type AdCreativePlatform =
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'reddit'
  | 'linkedin'
  | 'other';

export type AdCreativeMutationAxis =
  | 'net_new_concept'
  | 'hook'
  | 'opening_shot'
  | 'product_variant'
  | 'character'
  | 'cta'
  | 'platform_format'
  | 'visual_treatment'
  | 'landing_message';

export interface DirectorCreativeArtifactBinding {
  directorProjectId: string;
  directorArtifactId: string;
  artifactSha256: string;
  directorStageId?: string;
  directorStageVersion?: number;
  reviewDecisionId?: string;
  evidenceRefs: readonly string[];
}

export interface AdCreativeVariantLineage {
  id: GrowthId;
  contentProjectId: GrowthId;
  conceptId: GrowthId;
  platform: AdCreativePlatform;
  productIdentityRef: string;
  styleIdentityRef: string;
  mutationAxis: AdCreativeMutationAxis;
  mutationRef: string;
  controlVariantId?: GrowthId;
  fixedDimensionRefs: Readonly<Record<string, string>>;
  director: DirectorCreativeArtifactBinding;
  evidenceRefs: readonly string[];
  createdAt: ISODateTime;
  authority: 'EXPERIMENT_INPUT_ONLY';
}

export interface AdCreativeExperimentPlan {
  id: GrowthId;
  controlVariantId: GrowthId;
  treatmentVariantIds: readonly GrowthId[];
  mutationAxis: AdCreativeMutationAxis;
  hypotheses: Readonly<Record<string, string>>;
  binaryExperiments: readonly BinaryCreativeExperiment[];
  variantLineageRefs: Readonly<Record<string, string>>;
  evidenceRefs: readonly string[];
  authority: 'LEARNING_PLAN_ONLY';
}

function assertSha256(value: string): void {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('GROWTH_AD_ARTIFACT_SHA256_INVALID');
}

export function createAdCreativeVariantLineage(
  input: Omit<AdCreativeVariantLineage, 'authority'>,
): AdCreativeVariantLineage {
  if (!input.id.trim() || !input.contentProjectId.trim() || !input.conceptId.trim()) {
    throw new Error('GROWTH_AD_VARIANT_IDENTITY_REQUIRED');
  }
  if (!input.productIdentityRef.trim() || !input.styleIdentityRef.trim()) {
    throw new Error('GROWTH_AD_VARIANT_CREATIVE_IDENTITY_REQUIRED');
  }
  if (!input.mutationRef.trim()) throw new Error('GROWTH_AD_VARIANT_MUTATION_REF_REQUIRED');
  if (!input.evidenceRefs.length || !input.director.evidenceRefs.length) {
    throw new Error('GROWTH_AD_VARIANT_EVIDENCE_REQUIRED');
  }
  if (!input.director.directorProjectId.trim() || !input.director.directorArtifactId.trim()) {
    throw new Error('GROWTH_AD_VARIANT_DIRECTOR_BINDING_REQUIRED');
  }
  assertSha256(input.director.artifactSha256);
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error('GROWTH_AD_VARIANT_CREATED_AT_INVALID');
  if (input.controlVariantId && input.controlVariantId === input.id) {
    throw new Error('GROWTH_AD_VARIANT_CONTROL_SELF_REFERENCE');
  }
  for (const [key,value] of Object.entries(input.fixedDimensionRefs)) {
    if (!key.trim() || !value.trim()) throw new Error('GROWTH_AD_VARIANT_FIXED_DIMENSION_INVALID');
  }

  return Object.freeze({
    ...input,
    fixedDimensionRefs: Object.freeze({ ...input.fixedDimensionRefs }),
    director: Object.freeze({
      ...input.director,
      evidenceRefs: Object.freeze([...input.director.evidenceRefs]),
    }),
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    authority: 'EXPERIMENT_INPUT_ONLY',
  });
}

export function buildIsolatedAdCreativeExperimentPlan(input: {
  id: GrowthId;
  control: AdCreativeVariantLineage;
  treatments: readonly AdCreativeVariantLineage[];
  hypotheses: Readonly<Record<string,string>>;
  minimumExposuresPerVariant?: number;
  minimumConversionsPerVariant?: number;
  alpha?: number;
  minimumRelativeLift?: number;
  evidenceRefs: readonly string[];
}): AdCreativeExperimentPlan {
  if (!input.id.trim()) throw new Error('GROWTH_AD_EXPERIMENT_ID_REQUIRED');
  if (!input.treatments.length) throw new Error('GROWTH_AD_EXPERIMENT_TREATMENT_REQUIRED');
  if (!input.evidenceRefs.length) throw new Error('GROWTH_AD_EXPERIMENT_EVIDENCE_REQUIRED');

  const axis = input.treatments[0]!.mutationAxis;
  if (axis === 'net_new_concept') {
    throw new Error('GROWTH_AD_EXPERIMENT_NET_NEW_CONCEPT_NOT_ISOLATED');
  }

  const fixed = input.control.fixedDimensionRefs;
  for (const treatment of input.treatments) {
    if (treatment.id === input.control.id) throw new Error('GROWTH_AD_EXPERIMENT_VARIANTS_MUST_DIFFER');
    if (treatment.controlVariantId !== input.control.id) throw new Error('GROWTH_AD_EXPERIMENT_CONTROL_LINEAGE_REQUIRED');
    if (treatment.platform !== input.control.platform) throw new Error('GROWTH_AD_EXPERIMENT_PLATFORM_MISMATCH');
    if (treatment.mutationAxis !== axis) throw new Error('GROWTH_AD_EXPERIMENT_SINGLE_AXIS_REQUIRED');
    if (!input.hypotheses[treatment.id]?.trim()) throw new Error('GROWTH_AD_EXPERIMENT_HYPOTHESIS_REQUIRED');

    const keys = new Set([...Object.keys(fixed), ...Object.keys(treatment.fixedDimensionRefs)]);
    for (const key of keys) {
      if ((fixed[key] ?? '') !== (treatment.fixedDimensionRefs[key] ?? '')) {
        throw new Error(`GROWTH_AD_EXPERIMENT_INVARIANT_DRIFT:${key}`);
      }
    }

    if (axis !== 'product_variant' && treatment.productIdentityRef !== input.control.productIdentityRef) {
      throw new Error('GROWTH_AD_EXPERIMENT_PRODUCT_IDENTITY_DRIFT');
    }
    if (axis !== 'visual_treatment' && treatment.styleIdentityRef !== input.control.styleIdentityRef) {
      throw new Error('GROWTH_AD_EXPERIMENT_STYLE_IDENTITY_DRIFT');
    }
  }

  const minimumExposuresPerVariant = input.minimumExposuresPerVariant ?? 1000;
  const minimumConversionsPerVariant = input.minimumConversionsPerVariant ?? 20;
  const alpha = input.alpha ?? 0.05;
  const minimumRelativeLift = input.minimumRelativeLift ?? 0.1;
  const adjustedAlpha = alpha / input.treatments.length;

  const binaryExperiments = input.treatments.map((treatment): BinaryCreativeExperiment => Object.freeze({
    id: `${input.id}:${input.control.id}:vs:${treatment.id}`,
    controlVariantId: input.control.id,
    treatmentVariantId: treatment.id,
    hypothesis: input.hypotheses[treatment.id]!,
    minimumExposuresPerVariant,
    minimumConversionsPerVariant,
    alpha: adjustedAlpha,
    minimumRelativeLift,
    requireNonNegativeIncrementalContribution: true,
  }));

  const lineageRefs: Record<string,string> = {
    [input.control.id]: `director-artifact:${input.control.director.directorArtifactId}:${input.control.director.artifactSha256}`,
  };
  for (const treatment of input.treatments) {
    lineageRefs[treatment.id] = `director-artifact:${treatment.director.directorArtifactId}:${treatment.director.artifactSha256}`;
  }

  return Object.freeze({
    id: input.id,
    controlVariantId: input.control.id,
    treatmentVariantIds: Object.freeze(input.treatments.map(item => item.id)),
    mutationAxis: axis,
    hypotheses: Object.freeze({ ...input.hypotheses }),
    binaryExperiments: Object.freeze(binaryExperiments),
    variantLineageRefs: Object.freeze(lineageRefs),
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    authority: 'LEARNING_PLAN_ONLY',
  });
}

export type CreativeExperimentStatus = 'planned' | 'running' | 'completed' | 'cancelled';

export interface CreativeVariant {
  id: string;
  label: string;
  promptRef?: string;
  artifactIds: readonly string[];
  generationAttemptIds: readonly string[];
  notes?: readonly string[];
}

export interface CreativeExperiment {
  id: string;
  projectId: string;
  hypothesis: string;
  variable: string;
  status: CreativeExperimentStatus;
  variants: readonly CreativeVariant[];
  evidenceRefs: readonly string[];
  selectedVariantId?: string;
  selectedBy?: string;
  selectedAt?: string;
}

export interface CreativeExperimentDecision {
  valid: boolean;
  reasons: readonly string[];
}

/**
 * Preserve every tested variant and generation attempt. Selection is explicit;
 * a failed or discarded variant remains evidence instead of disappearing.
 */
export function validateCreativeExperiment(experiment: CreativeExperiment): CreativeExperimentDecision {
  const reasons: string[] = [];
  if (!experiment.id.trim()) reasons.push('DIRECTOR_EXPERIMENT_ID_REQUIRED');
  if (!experiment.projectId.trim()) reasons.push('DIRECTOR_EXPERIMENT_PROJECT_REQUIRED');
  if (!experiment.hypothesis.trim()) reasons.push('DIRECTOR_EXPERIMENT_HYPOTHESIS_REQUIRED');
  if (!experiment.variable.trim()) reasons.push('DIRECTOR_EXPERIMENT_VARIABLE_REQUIRED');
  if (experiment.variants.length < 2) reasons.push('DIRECTOR_EXPERIMENT_VARIANTS_REQUIRED');

  const ids = new Set(experiment.variants.map((variant) => variant.id));
  if (ids.size !== experiment.variants.length) reasons.push('DIRECTOR_EXPERIMENT_VARIANT_IDS_DUPLICATE');
  if (experiment.selectedVariantId && !ids.has(experiment.selectedVariantId)) {
    reasons.push('DIRECTOR_EXPERIMENT_SELECTION_UNKNOWN');
  }
  if (experiment.selectedVariantId && (!experiment.selectedBy || !experiment.selectedAt)) {
    reasons.push('DIRECTOR_EXPERIMENT_SELECTION_RECEIPT_REQUIRED');
  }

  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze(reasons) });
}

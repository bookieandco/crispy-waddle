export type RoughCutEvidenceKind =
  | 'spoken-take-marker'
  | 'spoken-step-label'
  | 'filename'
  | 'procedure-order'
  | 'manual-label'
  | 'transcript';

export interface RoughCutProcedureStep {
  id: string;
  order: number;
  text: string;
}

export interface RoughCutTakeEvidence {
  id: string;
  assetId: string;
  sourceStartSeconds: number;
  sourceEndSeconds: number;
  stepId?: string;
  confidence: number;
  kinds: readonly RoughCutEvidenceKind[];
  evidenceRefs: readonly string[];
  repeatedTakeGroupId?: string;
}

export interface RoughCutTakeDecision {
  takeId: string;
  disposition: 'place' | 'review';
  stepId?: string;
  reasons: readonly string[];
}

export interface RoughCutPlanDecision {
  placements: readonly RoughCutTakeDecision[];
  reviewQueue: readonly RoughCutTakeDecision[];
  missingStepIds: readonly string[];
}

/**
 * Evidence-driven rough-cut admission.
 *
 * Weak/unmatched footage is preserved for review instead of being silently
 * forced into the nearest procedure step. Repeated takes remain separate.
 */
export function decideRoughCutPlacement(
  steps: readonly RoughCutProcedureStep[],
  takes: readonly RoughCutTakeEvidence[],
  minimumConfidence = 0.6,
): RoughCutPlanDecision {
  const stepIds = new Set(steps.map((step) => step.id));
  const decisions = takes.map((take): RoughCutTakeDecision => {
    const reasons: string[] = [];
    if (!take.assetId.trim()) reasons.push('DIRECTOR_ROUGH_CUT_ASSET_REQUIRED');
    if (
      !Number.isFinite(take.sourceStartSeconds) ||
      !Number.isFinite(take.sourceEndSeconds) ||
      take.sourceStartSeconds < 0 ||
      take.sourceEndSeconds <= take.sourceStartSeconds
    ) reasons.push('DIRECTOR_ROUGH_CUT_RANGE_INVALID');
    if (!take.evidenceRefs.length) reasons.push('DIRECTOR_ROUGH_CUT_EVIDENCE_REQUIRED');
    if (!Number.isFinite(take.confidence) || take.confidence < 0 || take.confidence > 1) {
      reasons.push('DIRECTOR_ROUGH_CUT_CONFIDENCE_INVALID');
    }
    if (!take.stepId || !stepIds.has(take.stepId)) reasons.push('DIRECTOR_ROUGH_CUT_STEP_UNRESOLVED');
    if (take.confidence < minimumConfidence) reasons.push('DIRECTOR_ROUGH_CUT_CONFIDENCE_LOW');
    if (!take.kinds.some((kind) =>
      kind === 'spoken-step-label' ||
      kind === 'manual-label' ||
      kind === 'procedure-order' ||
      kind === 'filename'
    )) reasons.push('DIRECTOR_ROUGH_CUT_RELEVANCE_UNPROVEN');

    return Object.freeze({
      takeId: take.id,
      disposition: reasons.length ? 'review' : 'place',
      ...(reasons.length ? {} : { stepId: take.stepId }),
      reasons: Object.freeze(reasons),
    });
  });

  const placements = decisions.filter((decision) => decision.disposition === 'place');
  const placedStepIds = new Set(placements.map((decision) => decision.stepId).filter(Boolean));
  const missingStepIds = [...stepIds].filter((stepId) => !placedStepIds.has(stepId));

  return Object.freeze({
    placements: Object.freeze(placements),
    reviewQueue: Object.freeze(decisions.filter((decision) => decision.disposition === 'review')),
    missingStepIds: Object.freeze(missingStepIds),
  });
}

export type QualityDimensionResult = {
  dimension: string;
  score: number;
  passed: boolean;
  reason?: string;
};

export type ArtifactQualityAssessment = {
  id: string;
  assetId: string;
  evaluator: string;
  dimensions: QualityDimensionResult[];
  overallScore: number;
  passed: boolean;
  retryRecommended: boolean;
  retryCount: number;
  reasons: string[];
  evidence: string[];
  assessedAt: string;
};

function score(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`artifact_quality_${field}_invalid`);
}

/** Creates a validated, immutable quality result. It assesses; it never authorizes execution. */
export function createArtifactQualityAssessment(
  input: ArtifactQualityAssessment,
): ArtifactQualityAssessment {
  if (!input.id.trim()) throw new Error('artifact_quality_id_required');
  if (!input.assetId.trim()) throw new Error('artifact_quality_asset_id_required');
  if (!input.evaluator.trim()) throw new Error('artifact_quality_evaluator_required');
  score(input.overallScore, 'overall_score');
  if (!Number.isInteger(input.retryCount) || input.retryCount < 0) throw new Error('artifact_quality_retry_count_invalid');

  const seen = new Set<string>();
  for (const dimension of input.dimensions) {
    if (!dimension.dimension.trim()) throw new Error('artifact_quality_dimension_required');
    if (seen.has(dimension.dimension)) throw new Error(`artifact_quality_duplicate_dimension:${dimension.dimension}`);
    seen.add(dimension.dimension);
    score(dimension.score, 'dimension_score');
  }

  return Object.freeze({
    ...input,
    dimensions: Object.freeze(input.dimensions.map((dimension) => Object.freeze({ ...dimension }))),
    reasons: Object.freeze([...input.reasons]),
    evidence: Object.freeze([...input.evidence]),
  });
}

/** Converts a failed assessment into a planning signal without executing a retry. */
export function retrySignal(assessment: ArtifactQualityAssessment): {
  assetId: string;
  retryRecommended: boolean;
  reasons: string[];
  nextRetryCount: number;
} {
  return {
    assetId: assessment.assetId,
    retryRecommended: assessment.retryRecommended && !assessment.passed,
    reasons: [...assessment.reasons],
    nextRetryCount: assessment.retryCount + 1,
  };
}

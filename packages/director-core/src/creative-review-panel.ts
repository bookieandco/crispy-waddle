export type CreativeReviewVerdict = 'pass' | 'warn' | 'fail' | 'inconclusive';

export interface CreativeReview {
  id: string;
  artifactId: string;
  artifactSha256: string;
  reviewerId: string;
  reviewerFamily: string;
  producerFamily?: string;
  verdict: CreativeReviewVerdict;
  evidenceRefs: readonly string[];
  reviewedAt: string;
  notes?: readonly string[];
}

export interface CreativeReviewPanelPolicy {
  minimumDistinctReviewerFamilies: number;
  allowWarnings: boolean;
  requireProducerIndependence: boolean;
}

export interface CreativeReviewPanelDecision {
  accepted: boolean;
  reasons: readonly string[];
  reviewerFamilies: readonly string[];
  reviewIds: readonly string[];
}

/**
 * Deterministic review fusion. A producer cannot self-acquit when independence
 * is required, all reviews must refer to the exact same artifact digest, and
 * inconclusive reviews never count as passing quorum.
 */
export function decideCreativeReviewPanel(
  reviews: readonly CreativeReview[],
  policy: CreativeReviewPanelPolicy,
): CreativeReviewPanelDecision {
  const reasons: string[] = [];
  if (!reviews.length) reasons.push('DIRECTOR_REVIEW_PANEL_EMPTY');

  const digests = new Set(reviews.map((review) => review.artifactSha256));
  if (digests.size > 1) reasons.push('DIRECTOR_REVIEW_ARTIFACT_DIGEST_MISMATCH');

  const eligible = reviews.filter((review) => {
    if (review.verdict === 'inconclusive') return false;
    if (policy.requireProducerIndependence && review.producerFamily && review.reviewerFamily === review.producerFamily) return false;
    return true;
  });

  if (policy.requireProducerIndependence && eligible.length < reviews.filter((review) => review.verdict !== 'inconclusive').length) {
    reasons.push('DIRECTOR_REVIEW_SELF_ACQUITTAL_EXCLUDED');
  }

  const reviewerFamilies = [...new Set(eligible.map((review) => review.reviewerFamily))];
  if (reviewerFamilies.length < policy.minimumDistinctReviewerFamilies) {
    reasons.push('DIRECTOR_REVIEW_FAMILY_QUORUM_NOT_MET');
  }

  if (eligible.some((review) => review.verdict === 'fail')) reasons.push('DIRECTOR_REVIEW_PANEL_FAILURE');
  if (!policy.allowWarnings && eligible.some((review) => review.verdict === 'warn')) reasons.push('DIRECTOR_REVIEW_PANEL_WARNING_BLOCKED');

  const passing = eligible.filter((review) => review.verdict === 'pass' || (policy.allowWarnings && review.verdict === 'warn'));
  if (passing.length === 0) reasons.push('DIRECTOR_REVIEW_NO_AFFIRMATIVE_RESULT');

  return Object.freeze({
    accepted: reasons.length === 0,
    reasons: Object.freeze(reasons),
    reviewerFamilies: Object.freeze(reviewerFamilies),
    reviewIds: Object.freeze(passing.map((review) => review.id)),
  });
}

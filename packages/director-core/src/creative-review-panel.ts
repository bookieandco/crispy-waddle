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
  excludedReviewIds: readonly string[];
}

/**
 * Deterministic review fusion. Producer-family self-reviews and inconclusive
 * reviews are excluded from quorum rather than counted as passing evidence.
 * All eligible reviews must bind to the same exact artifact identity/digest.
 */
export function decideCreativeReviewPanel(
  reviews: readonly CreativeReview[],
  policy: CreativeReviewPanelPolicy,
): CreativeReviewPanelDecision {
  const reasons: string[] = [];
  if (!reviews.length) reasons.push('DIRECTOR_REVIEW_PANEL_EMPTY');

  const artifactIds = new Set(reviews.map((review) => review.artifactId));
  if (artifactIds.size > 1) reasons.push('DIRECTOR_REVIEW_ARTIFACT_ID_MISMATCH');

  const digests = new Set(reviews.map((review) => review.artifactSha256));
  if (digests.size > 1) reasons.push('DIRECTOR_REVIEW_ARTIFACT_DIGEST_MISMATCH');

  const excludedReviewIds: string[] = [];
  const eligible = reviews.filter((review) => {
    if (review.verdict === 'inconclusive') {
      excludedReviewIds.push(review.id);
      return false;
    }
    if (
      policy.requireProducerIndependence &&
      review.producerFamily &&
      review.reviewerFamily === review.producerFamily
    ) {
      excludedReviewIds.push(review.id);
      return false;
    }
    return true;
  });

  const reviewerFamilies = [...new Set(eligible.map((review) => review.reviewerFamily))];
  if (reviewerFamilies.length < policy.minimumDistinctReviewerFamilies) {
    reasons.push('DIRECTOR_REVIEW_FAMILY_QUORUM_NOT_MET');
  }

  if (eligible.some((review) => review.verdict === 'fail')) reasons.push('DIRECTOR_REVIEW_PANEL_FAILURE');
  if (!policy.allowWarnings && eligible.some((review) => review.verdict === 'warn')) {
    reasons.push('DIRECTOR_REVIEW_PANEL_WARNING_BLOCKED');
  }

  const passing = eligible.filter(
    (review) => review.verdict === 'pass' || (policy.allowWarnings && review.verdict === 'warn'),
  );
  if (passing.length === 0) reasons.push('DIRECTOR_REVIEW_NO_AFFIRMATIVE_RESULT');

  return Object.freeze({
    accepted: reasons.length === 0,
    reasons: Object.freeze(reasons),
    reviewerFamilies: Object.freeze(reviewerFamilies),
    reviewIds: Object.freeze(passing.map((review) => review.id)),
    excludedReviewIds: Object.freeze(excludedReviewIds),
  });
}

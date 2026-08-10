export type CreativeReviewEventType =
  | "CREATIVE_REVIEW_FEEDBACK_RECORDED"
  | "CREATIVE_REVIEW_CALIBRATED";

export interface CreativeReviewEvent<TPayload = Record<string, unknown>> {
  id: string;
  type: CreativeReviewEventType;
  occurredAt: string;
  payload: TPayload;
  source: "jei";
}

export function createReviewFeedbackEvent(
  feedbackId: string,
  reviewId: string,
  signal: "positive" | "negative" | "study",
): CreativeReviewEvent {
  return {
    id: `creative-review-feedback:${feedbackId}`,
    type: "CREATIVE_REVIEW_FEEDBACK_RECORDED",
    occurredAt: new Date().toISOString(),
    payload: { feedbackId, reviewId, signal },
    source: "jei",
  };
}

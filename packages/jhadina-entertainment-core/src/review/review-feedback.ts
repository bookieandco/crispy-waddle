export type ReviewFeedbackSignal = "positive" | "negative" | "study";

export interface ReviewFeedback {
  id: string;
  reviewId: string;
  signal: ReviewFeedbackSignal;
  targetFeature?: string;
  reason?: string;
  createdAt: string;
  source: "user";
}

export interface ReviewCalibration {
  reviewId: string;
  feature: string;
  positive: number;
  negative: number;
  study: number;
  confidence: number;
}

export interface ReviewFeedbackRepository {
  record(feedback: ReviewFeedback): Promise<void>;
  list(reviewId: string): Promise<ReviewFeedback[]>;
}

export class InMemoryReviewFeedbackRepository implements ReviewFeedbackRepository {
  private readonly feedback = new Map<string, ReviewFeedback>();

  async record(feedback: ReviewFeedback): Promise<void> {
    this.feedback.set(feedback.id, feedback);
  }

  async list(reviewId: string): Promise<ReviewFeedback[]> {
    return [...this.feedback.values()].filter((item) => item.reviewId === reviewId);
  }
}

export class ReviewCalibrationEngine {
  constructor(private readonly repository: ReviewFeedbackRepository) {}

  async record(feedback: ReviewFeedback): Promise<void> {
    await this.repository.record(feedback);
  }

  async calibrate(reviewId: string, feature: string): Promise<ReviewCalibration> {
    const items = (await this.repository.list(reviewId)).filter(
      (item) => !item.targetFeature || item.targetFeature === feature,
    );
    const positive = items.filter((item) => item.signal === "positive").length;
    const negative = items.filter((item) => item.signal === "negative").length;
    const study = items.filter((item) => item.signal === "study").length;
    const total = positive + negative;
    const confidence = total === 0 ? 0.5 : positive / total;

    return { reviewId, feature, positive, negative, study, confidence };
  }
}

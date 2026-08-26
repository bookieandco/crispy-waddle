import type { LearningCandidate } from './learning-content.js';

export type LearningGateway = {
  submit(candidate: LearningCandidate): Promise<void>;
};

export function createLearningGateway(consumer: (candidate: LearningCandidate) => Promise<void>): LearningGateway {
  return { submit: consumer };
}

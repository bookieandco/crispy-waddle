import type { PerceptionObservation } from "./perception-contract";

export interface SalienceInput {
  userRequested?: boolean;
  changed?: boolean;
  confidence: number;
  novelty?: number;
  taskRelevance?: number;
}

export class SalienceEngine {
  score(input: SalienceInput): number {
    if (input.userRequested) return 1;
    const change = input.changed ? 0.35 : 0;
    const novelty = Math.max(0, Math.min(1, input.novelty ?? 0));
    const relevance = Math.max(0, Math.min(1, input.taskRelevance ?? 0));
    const confidence = Math.max(0, Math.min(1, input.confidence));
    return Math.min(1, change + novelty * 0.25 + relevance * 0.25 + confidence * 0.15);
  }

  shouldSurface(observation: PerceptionObservation, threshold = 0.6): boolean {
    return (observation.salience ?? 0) >= threshold;
  }
}

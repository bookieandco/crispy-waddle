import type { MemoryProposal, PatternObservation, Experience } from './types.js';
import type { PatternDetectionStrategy } from './pattern-engine.js';

/**
 * Composite strategy: runs independent detectors and merges observations by id.
 * Each detector remains responsible for its own semantics; this layer only
 * composes results and never grants personality eligibility.
 */
export class CompositePatternDetectionStrategy implements PatternDetectionStrategy {
  constructor(private readonly strategies: readonly PatternDetectionStrategy[]) {
    if (strategies.length === 0) throw new RangeError('at least one pattern strategy is required');
  }

  detect(experience: Experience, memories: MemoryProposal[]): PatternObservation[] {
    const merged = new Map<string, PatternObservation>();
    for (const strategy of this.strategies) {
      for (const observation of strategy.detect(experience, memories)) {
        if (!merged.has(observation.id)) {
          merged.set(observation.id, {
            ...observation,
            evidence: observation.evidence.map((ref) => ({ ...ref })),
            contradictions: observation.contradictions.map((ref) => ({ ...ref })),
          });
        }
      }
    }
    return [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}

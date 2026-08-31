import type { ResearchSourcePerformance } from './research-source-performance.js';

export type ResearchIntentKind =
  | 'current'
  | 'cultural'
  | 'stored-knowledge'
  | 'factual'
  | 'opinion'
  | 'technical'
  | 'historical'
  | 'mixed';

export interface ResearchIntentPerformance extends ResearchSourcePerformance {
  sourceId: string;
  intent: ResearchIntentKind;
}

/**
 * Keeps learned source usefulness scoped to the kind of research being performed.
 * This is routing memory only; it never establishes factual truth or authorization.
 */
export class ResearchIntentPerformanceStore {
  private readonly state = new Map<string, ResearchIntentPerformance>();

  private key(sourceId: string, intent: ResearchIntentKind): string {
    return `${sourceId}::${intent}`;
  }

  get(sourceId: string, intent: ResearchIntentKind): ResearchIntentPerformance | undefined {
    return this.state.get(this.key(sourceId, intent));
  }

  set(value: ResearchIntentPerformance): void {
    this.state.set(this.key(value.sourceId, value.intent), value);
  }

  /**
   * Convert source-level posterior state into an intent-scoped prior without
   * claiming that the source has already been tested for this intent.
   */
  seed(sourceId: string, intent: ResearchIntentKind, base?: ResearchSourcePerformance): ResearchIntentPerformance {
    const existing = this.get(sourceId, intent);
    if (existing) return existing;
    const seeded: ResearchIntentPerformance = {
      sourceId,
      intent,
      investigations: 0,
      usefulEvidence: 0,
      corroboratedEvidence: 0,
      verifiedEvidence: 0,
      rejectedEvidence: 0,
      score: base?.score ?? 0,
      decayedScore: base?.decayedScore ?? 0,
      posteriorMean: base?.posteriorMean ?? 0.5,
      posteriorLowerBound: base?.posteriorLowerBound ?? 0,
      posteriorUpperBound: base?.posteriorUpperBound ?? 1,
      updatedAt: base?.updatedAt ?? new Date(0).toISOString(),
    };
    this.set(seeded);
    return seeded;
  }

  listForIntent(intent: ResearchIntentKind): ResearchIntentPerformance[] {
    return [...this.state.values()].filter(value => value.intent === intent);
  }
}

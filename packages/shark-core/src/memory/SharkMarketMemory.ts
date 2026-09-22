import type { SharkDecision } from '../decisions/SharkDecision';
import type { SharkObservation } from '../observations/SharkObservation';
import type { LearningSample, SharkLearningState } from '../learning/SharkLearning';
import type { SharkOutcome } from '../outcomes/SharkOutcome';

/**
 * Immutable market-memory record. It preserves the snapshot that existed when
 * Shark made a decision so later learning cannot rewrite the original evidence.
 */
export interface SharkMarketMemory {
  readonly id: string;
  readonly subjectId: string;
  readonly decisionId: string;
  readonly observedAt: string;
  readonly decisionAt: string;
  readonly observationIds: readonly string[];
  readonly featureVector: Readonly<Record<string, number>>;
  readonly tags: readonly string[];
  readonly outcomeId?: string;
}

export interface MarketMemoryRepository {
  save(memory: SharkMarketMemory): Promise<void>;
  attachOutcome(decisionId: string, outcomeId: string): Promise<void>;
  getByDecision(decisionId: string): Promise<SharkMarketMemory | undefined>;
  findComparable(subjectId: string, featureVector: Readonly<Record<string, number>>, limit?: number): Promise<readonly SharkMarketMemory[]>;
}

export class InMemoryMarketMemoryRepository implements MarketMemoryRepository {
  private readonly records = new Map<string, SharkMarketMemory>();

  async save(memory: SharkMarketMemory): Promise<void> {
    if (this.records.has(memory.id)) throw new Error(`Market memory already exists: ${memory.id}`);
    this.records.set(memory.id, Object.freeze({ ...memory, observationIds: [...memory.observationIds], tags: [...memory.tags] }));
  }

  async attachOutcome(decisionId: string, outcomeId: string): Promise<void> {
    const existing = [...this.records.values()].find((record) => record.decisionId === decisionId);
    if (!existing) throw new Error(`Market memory not found for decision: ${decisionId}`);
    this.records.set(existing.id, Object.freeze({ ...existing, outcomeId }));
  }

  async getByDecision(decisionId: string): Promise<SharkMarketMemory | undefined> {
    return [...this.records.values()].find((record) => record.decisionId === decisionId);
  }

  async findComparable(subjectId: string, featureVector: Readonly<Record<string, number>>, limit = 20): Promise<readonly SharkMarketMemory[]> {
    const distance = (record: SharkMarketMemory): number => {
      const keys = new Set([...Object.keys(featureVector), ...Object.keys(record.featureVector)]);
      return [...keys].reduce((sum, key) => sum + Math.abs((featureVector[key] ?? 0) - (record.featureVector[key] ?? 0)), 0);
    };
    return [...this.records.values()]
      .filter((record) => record.subjectId === subjectId)
      .sort((a, b) => distance(a) - distance(b))
      .slice(0, Math.max(0, limit));
  }
}

/**
 * Captures the decision-time snapshot without granting execution authority.
 */
export function createMarketMemory(
  decision: SharkDecision,
  observations: readonly SharkObservation[],
  featureVector: Readonly<Record<string, number>>,
  id: string,
): SharkMarketMemory {
  return Object.freeze({
    id,
    subjectId: decision.subjectId,
    decisionId: decision.id,
    observedAt: observations.reduce((latest, item) => item.observedAt > latest ? item.observedAt : latest, decision.createdAt),
    decisionAt: decision.createdAt,
    observationIds: observations.map((item) => item.id),
    featureVector: { ...featureVector },
    tags: [...new Set(observations.flatMap((item) => item.tags ?? []))],
  });
}

/** Converts an outcome + frozen memory into the learning sample consumed by SharkLearning. */
export function createLearningSample(memory: SharkMarketMemory, outcome: SharkOutcome): LearningSample {
  if (memory.decisionId !== outcome.decisionId) throw new Error('Outcome does not belong to market memory decision');
  return { decisionId: memory.decisionId, outcome, featureVector: memory.featureVector };
}

export function learningStateCanUpdate(_state: SharkLearningState, sample: LearningSample): boolean {
  return sample.decisionId.length > 0 && sample.outcome.evidenceIds.length > 0;
}

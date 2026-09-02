import type { HumorMode } from './humor.js';

export interface SharedJoke {
  id: string;
  relationshipId?: string;
  phrase: string;
  context: string;
  mode: HumorMode;
  confidence: number;
  uses: number;
  positiveReactions: number;
  negativeReactions: number;
  lastUsedAt: string;
  status: 'candidate' | 'accepted' | 'retired';
}

export interface CallbackObservation {
  relationshipId?: string;
  phrase: string;
  context: string;
  mode: HumorMode;
  signal: 'positive' | 'negative' | 'neutral';
  at: string;
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Durable-shaped shared-joke memory. The caller persists snapshots; this class owns learning rules. */
export class CallbackMemory {
  private readonly jokes = new Map<string, SharedJoke>();

  observe(input: CallbackObservation): SharedJoke {
    const key = `${input.relationshipId ?? '*'}:${input.phrase.trim().toLowerCase()}`;
    const prior = this.jokes.get(key);
    const uses = (prior?.uses ?? 0) + 1;
    const positiveReactions = (prior?.positiveReactions ?? 0) + (input.signal === 'positive' ? 1 : 0);
    const negativeReactions = (prior?.negativeReactions ?? 0) + (input.signal === 'negative' ? 1 : 0);
    const evidence = positiveReactions + negativeReactions;
    const confidence = clamp(evidence === 0 ? 0.5 : 0.5 + (positiveReactions - negativeReactions) / Math.max(4, uses * 2));
    const joke: SharedJoke = {
      id: prior?.id ?? `shared-joke:${key}`,
      relationshipId: input.relationshipId,
      phrase: input.phrase,
      context: input.context,
      mode: input.mode,
      confidence,
      uses,
      positiveReactions,
      negativeReactions,
      lastUsedAt: input.at,
      status: confidence >= 0.65 && positiveReactions >= 2 ? 'accepted' : confidence <= 0.25 && negativeReactions >= 2 ? 'retired' : 'candidate',
    };
    this.jokes.set(key, joke);
    return { ...joke };
  }

  candidates(relationshipId?: string, limit = 10): SharedJoke[] {
    return [...this.jokes.values()]
      .filter((joke) => joke.status !== 'retired' && (!joke.relationshipId || joke.relationshipId === relationshipId))
      .sort((a, b) => b.confidence - a.confidence || b.lastUsedAt.localeCompare(a.lastUsedAt))
      .slice(0, limit)
      .map((joke) => ({ ...joke }));
  }

  snapshot(): SharedJoke[] {
    return [...this.jokes.values()].map((joke) => ({ ...joke }));
  }
}

export type VoiceDimension = 'phrase' | 'rhythm' | 'directness' | 'warmth' | 'sharpness' | 'profanity';

export interface VoiceObservation {
  relationshipId?: string;
  dimension: VoiceDimension;
  value: string;
  signal: 'positive' | 'negative' | 'neutral';
  at: string;
}

export interface VoicePattern {
  id: string;
  relationshipId?: string;
  dimension: VoiceDimension;
  value: string;
  confidence: number;
  observations: number;
  positive: number;
  negative: number;
  lastObservedAt: string;
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Learns recurring voice choices from evidence without allowing a single interaction to define identity. */
export class VoiceMemory {
  private readonly patterns = new Map<string, VoicePattern>();

  observe(input: VoiceObservation): VoicePattern {
    const normalized = input.value.trim().toLowerCase();
    const key = `${input.relationshipId ?? '*'}:${input.dimension}:${normalized}`;
    const previous = this.patterns.get(key);
    const observations = (previous?.observations ?? 0) + 1;
    const positive = (previous?.positive ?? 0) + (input.signal === 'positive' ? 1 : 0);
    const negative = (previous?.negative ?? 0) + (input.signal === 'negative' ? 1 : 0);
    const confidence = clamp(0.5 + (positive - negative) / Math.max(4, observations * 2));
    const pattern: VoicePattern = {
      id: previous?.id ?? `voice-pattern:${key}`,
      relationshipId: input.relationshipId,
      dimension: input.dimension,
      value: input.value,
      confidence,
      observations,
      positive,
      negative,
      lastObservedAt: input.at,
    };
    this.patterns.set(key, pattern);
    return { ...pattern };
  }

  preferred(dimension: VoiceDimension, relationshipId?: string, limit = 5): VoicePattern[] {
    return [...this.patterns.values()]
      .filter((pattern) => pattern.dimension === dimension && (!pattern.relationshipId || pattern.relationshipId === relationshipId))
      .sort((a, b) => b.confidence - a.confidence || b.observations - a.observations)
      .slice(0, limit)
      .map((pattern) => ({ ...pattern }));
  }

  snapshot(): VoicePattern[] {
    return [...this.patterns.values()].map((pattern) => ({ ...pattern }));
  }
}

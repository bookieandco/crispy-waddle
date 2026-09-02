import type { HumorFeedback, HumorMode } from './humor.js';

export interface HumorEpisode {
  candidateId: string;
  relationshipId?: string;
  mode: HumorMode;
  context: string;
  line: string;
  signal: HumorFeedback['signal'];
  explicit: boolean;
  at: string;
}

export interface HumorPattern {
  id: string;
  relationshipId?: string;
  mode: HumorMode;
  confidence: number;
  observations: number;
  positive: number;
  negative: number;
  lastObservedAt: string;
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Evidence-backed memory for humor preferences. It records reactions; it does not invent preferences. */
export class HumorMemory {
  private readonly episodes: HumorEpisode[] = [];
  private readonly patterns = new Map<string, HumorPattern>();

  record(episode: HumorEpisode): HumorPattern {
    this.episodes.push({ ...episode });
    const key = `${episode.relationshipId ?? '*'}:${episode.mode}`;
    const previous = this.patterns.get(key);
    const positive = (previous?.positive ?? 0) + (episode.signal === 'positive' ? 1 : 0);
    const negative = (previous?.negative ?? 0) + (episode.signal === 'negative' ? 1 : 0);
    const observations = (previous?.observations ?? 0) + 1;
    const confidence = clamp(0.5 + (positive - negative) / Math.max(4, observations * 2));
    const pattern: HumorPattern = {
      id: `humor-pattern:${key}`,
      relationshipId: episode.relationshipId,
      mode: episode.mode,
      confidence,
      observations,
      positive,
      negative,
      lastObservedAt: episode.at,
    };
    this.patterns.set(key, pattern);
    return { ...pattern };
  }

  getPattern(mode: HumorMode, relationshipId?: string): HumorPattern | undefined {
    const exact = this.patterns.get(`${relationshipId ?? '*'}:${mode}`);
    if (exact) return { ...exact };
    const global = this.patterns.get(`*:${mode}`);
    return global ? { ...global } : undefined;
  }

  rankModes(modes: HumorMode[], relationshipId?: string): HumorMode[] {
    return [...modes].sort((a, b) => {
      const pa = this.getPattern(a, relationshipId)?.confidence ?? 0.5;
      const pb = this.getPattern(b, relationshipId)?.confidence ?? 0.5;
      return pb - pa;
    });
  }

  recent(limit = 20): HumorEpisode[] {
    return this.episodes.slice(-limit).map((episode) => ({ ...episode }));
  }
}

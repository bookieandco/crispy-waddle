export type ObservationModality = 'vision' | 'transcript' | 'audio';
export type ObservationKind = string;
export type TimeRange = { startSeconds: number; endSeconds: number };

export type Observation = {
  id: string;
  assetId: string;
  source: string;
  modality: ObservationModality;
  kind: ObservationKind;
  time: TimeRange;
  label?: string;
  text?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

export type ObservationQuery = {
  assetId?: string;
  modalities?: ObservationModality[];
  kinds?: string[];
  text?: string;
  startSeconds?: number;
  endSeconds?: number;
};

export interface ObservationSink {
  publish(observations: Observation[]): Promise<void>;
}

export class InMemoryObservationBus implements ObservationSink {
  private readonly observations: Observation[] = [];

  async publish(observations: Observation[]): Promise<void> {
    this.observations.push(...observations);
  }

  query(query: ObservationQuery = {}): Observation[] {
    const text = query.text?.trim().toLowerCase();
    return this.observations.filter(item => {
      if (query.assetId && item.assetId !== query.assetId) return false;
      if (query.modalities?.length && !query.modalities.includes(item.modality)) return false;
      if (query.kinds?.length && !query.kinds.includes(item.kind)) return false;
      if (query.startSeconds !== undefined && item.time.endSeconds < query.startSeconds) return false;
      if (query.endSeconds !== undefined && item.time.startSeconds > query.endSeconds) return false;
      if (text) {
        const haystack = [item.label ?? '', item.text ?? '', item.kind, item.source].join(' ').toLowerCase();
        if (!haystack.includes(text)) return false;
      }
      return true;
    });
  }

  clear(): void {
    this.observations.length = 0;
  }
}

export function observationFromVision(input: Omit<Observation, 'modality'>): Observation {
  return { ...input, modality: 'vision' };
}

export function observationFromTranscript(input: Omit<Observation, 'modality'>): Observation {
  return { ...input, modality: 'transcript' };
}

export function observationFromAudio(input: Omit<Observation, 'modality'>): Observation {
  return { ...input, modality: 'audio' };
}

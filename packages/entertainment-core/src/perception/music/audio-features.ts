export interface AudioInput {
  id: string;
  sourceUri: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface AudioFeatures {
  durationMs: number;
  bpm?: number;
  loudness?: number;
  dynamicRange?: number;
  spectralCentroid?: number;
  energyCurve?: number[];
  sectionBoundaries?: number[];
  transitionPoints?: number[];
  firstHookMs?: number;
}

export interface MusicPerceptionEngine {
  analyze(input: AudioInput): Promise<AudioFeatures>;
}

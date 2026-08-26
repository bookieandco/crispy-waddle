import type { MediaAsset } from './media-ingestion.js';

export type VisionShape = 'bbox' | 'polygon' | 'mask' | 'point' | 'skeleton';

export type VisionObservation = {
  id: string;
  assetId: string;
  frame: number;
  timeSeconds: number;
  label: string;
  confidence?: number;
  shape: VisionShape;
  geometry: number[];
  attributes?: Record<string, string | number | boolean>;
  trackId?: string;
};

export type VisionTrack = {
  id: string;
  assetId: string;
  label: string;
  observations: VisionObservation[];
  firstSeenSeconds: number;
  lastSeenSeconds: number;
};

export type VisionAnalysis = {
  assetId: string;
  modelId: string;
  observations: VisionObservation[];
  tracks: VisionTrack[];
};

export interface VisionAnalyzer {
  readonly id: string;
  analyze(asset: MediaAsset): Promise<VisionAnalysis>;
}

/** Converts vision observations into editorially useful search signals without changing the timeline. */
export function findVisionMatches(
  analysis: VisionAnalysis,
  query: string,
): VisionObservation[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return analysis.observations.filter(observation =>
    observation.label.toLowerCase().includes(needle),
  );
}

export type MediaQualityKind = 'image' | 'video';

export type MediaQualityStatus = 'pass' | 'warn' | 'fail';

export interface MediaQualityEvidence {
  id: string;
  artifactId: string;
  kind: MediaQualityKind;
  status: MediaQualityStatus;
  score?: number;
  checkedAt: string;
  checker: string;
  metrics: Record<string, number | string | boolean>;
  notes?: string[];
}

export interface ImageQualityMetrics {
  width: number;
  height: number;
  bitDepth?: number;
  hdr?: boolean;
  colorSpace?: string;
  dynamicRangeStops?: number;
  clippingFraction?: number;
}

export interface VideoQualityMetrics {
  width: number;
  height: number;
  frameRate?: number;
  durationSeconds?: number;
  codec?: string;
  pixelFormat?: string;
  droppedFrames?: number;
  sceneOrVersionDelta?: number;
}

export function assessImageQuality(metrics: ImageQualityMetrics): MediaQualityStatus {
  if (metrics.width <= 0 || metrics.height <= 0) return 'fail';
  if ((metrics.clippingFraction ?? 0) > 0.05) return 'warn';
  return 'pass';
}

export function assessVideoQuality(metrics: VideoQualityMetrics): MediaQualityStatus {
  if (metrics.width <= 0 || metrics.height <= 0) return 'fail';
  if ((metrics.droppedFrames ?? 0) > 0) return 'warn';
  return 'pass';
}

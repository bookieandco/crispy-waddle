import type { EvidenceRef, ISODateTime, Sport } from './contracts.js';

export type VisualObjectClass = 'PLAYER' | 'OFFICIAL' | 'BALL' | 'PUCK' | 'VENUE_OBJECT' | 'UNKNOWN';

export interface VideoFrameRef {
  videoId: string;
  frameNumber: number;
  timestamp: ISODateTime;
  mediaTimeMs: number;
  contentHash: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionObservation {
  detectionId: string;
  frame: VideoFrameRef;
  class: VisualObjectClass;
  confidence: number;
  box: BoundingBox;
  modelId: string;
  modelVersion: string;
  evidenceIds: string[];
}

export interface TrackObservation {
  trackId: string;
  frame: VideoFrameRef;
  detectionId: string;
  class: VisualObjectClass;
  box: BoundingBox;
  associationConfidence: number;
  trackerId: string;
  trackerVersion: string;
  reIdReference?: string;
  evidenceIds: string[];
}

export interface IdentityHypothesis {
  trackId: string;
  candidateCanonicalIds: string[];
  method: 'PROVIDER_ID' | 'ROSTER_CONTEXT' | 'FACE_EMBEDDING' | 'JERSEY_NUMBER' | 'GEOMETRY' | 'MULTIMODAL';
  confidence: number;
  asOf: ISODateTime;
  evidenceIds: string[];
}

export interface VisualEventObservation {
  eventObservationId: string;
  eventId: string;
  sport: Sport;
  frame: VideoFrameRef;
  type: string;
  actorTrackIds: string[];
  objectTrackIds: string[];
  confidence: number;
  evidenceIds: string[];
  source: 'DETECTOR' | 'TRACKER' | 'VISION_MODEL' | 'HUMAN_ANNOTATION';
}

export interface PerceptionFrameResult {
  frame: VideoFrameRef;
  detections: DetectionObservation[];
  tracks: TrackObservation[];
  identityHypotheses: IdentityHypothesis[];
  events: VisualEventObservation[];
}

export interface TrackerAdapter {
  readonly trackerId: string;
  readonly trackerVersion: string;
  update(detections: readonly DetectionObservation[]): TrackObservation[];
  reset(): void;
}

export interface VisualIdentityResolver {
  resolve(track: TrackObservation, asOf: ISODateTime): IdentityHypothesis | undefined;
}

export interface AnnotationObservation {
  annotationId: string;
  videoId: string;
  frameNumber: number;
  timestamp: ISODateTime;
  label: string;
  payload: Readonly<Record<string, unknown>>;
  annotator: 'HUMAN' | 'MODEL_ASSISTED';
  evidenceIds: string[];
}

export interface AnnotationSource {
  list(videoId: string, asOf: ISODateTime): readonly AnnotationObservation[];
}

export function validateDetection(detection: DetectionObservation): void {
  if (!detection.detectionId || !detection.frame.videoId) throw new Error('Detection requires stable identifiers');
  if (!Number.isFinite(detection.confidence) || detection.confidence < 0 || detection.confidence > 1) throw new Error('Detection confidence must be within [0,1]');
  if (!Number.isFinite(detection.box.x) || !Number.isFinite(detection.box.y) || !Number.isFinite(detection.box.width) || !Number.isFinite(detection.box.height) || detection.box.width < 0 || detection.box.height < 0) {
    throw new Error('Detection bounding box must be finite and non-negative');
  }
  if (!detection.modelId || !detection.modelVersion || detection.evidenceIds.length === 0) throw new Error('Detection requires model lineage and evidence');
}

export function validateTrack(track: TrackObservation): void {
  if (!track.trackId || !track.detectionId || !track.trackerId || !track.trackerVersion) throw new Error('Track requires stable tracker lineage');
  if (!Number.isFinite(track.associationConfidence) || track.associationConfidence < 0 || track.associationConfidence > 1) throw new Error('Association confidence must be within [0,1]');
  if (track.evidenceIds.length === 0) throw new Error('Track requires evidence');
}

export function validateIdentityHypothesis(hypothesis: IdentityHypothesis): void {
  if (!hypothesis.trackId || hypothesis.candidateCanonicalIds.length === 0) throw new Error('Identity hypothesis requires candidates');
  if (!Number.isFinite(hypothesis.confidence) || hypothesis.confidence < 0 || hypothesis.confidence > 1) throw new Error('Identity confidence must be within [0,1]');
  if (hypothesis.evidenceIds.length === 0) throw new Error('Identity hypothesis requires evidence');
}

export function evidenceForVisualObservation(observation: DetectionObservation | TrackObservation | VisualEventObservation): EvidenceRef[] {
  return observation.evidenceIds.map((evidenceId) => ({
    evidenceId,
    sourceId: 'visual-perception',
    domain: 'WORLD',
    observedAt: observation.frame.timestamp,
    receivedAt: observation.frame.timestamp,
    quality: 'UNKNOWN',
    contentHash: observation.frame.contentHash,
  }));
}

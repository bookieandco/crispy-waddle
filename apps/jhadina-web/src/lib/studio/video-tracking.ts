export type TrackClass = "character" | "clothing" | "hair" | "hand" | "prop" | "environment";

export interface FrameAnnotation {
  frame: number;
  class: TrackClass;
  instanceId: string;
  confidence: number;
  bbox?: { x: number; y: number; width: number; height: number };
  maskRef?: string;
  keypoints?: Array<{ name: string; x: number; y: number; confidence: number }>;
}

export interface VideoTrack {
  trackId: string;
  class: TrackClass;
  instanceId: string;
  frameStart: number;
  frameEnd: number;
  annotations: FrameAnnotation[];
  source: "model" | "human" | "hybrid";
  confidence: number;
  approved: boolean;
}

export interface TrackingRequest {
  videoUrl: string;
  frameStart: number;
  frameEnd: number;
  classes: TrackClass[];
  seedAnnotations?: FrameAnnotation[];
}

export interface TrackingArtifact {
  artifactId: string;
  tracks: VideoTrack[];
  segmentationRefs: string[];
  keypointRefs: string[];
}

export function validateTrack(track: VideoTrack): string[] {
  const warnings: string[] = [];
  if (track.frameEnd < track.frameStart) warnings.push("Track frame range is invalid.");
  if (!track.annotations.length) warnings.push("Track contains no frame annotations.");
  if (track.confidence < 0.5) warnings.push("Track confidence is below the recommended threshold.");
  return warnings;
}

export function tracksToRigInputs(tracks: VideoTrack[]) {
  return tracks.filter(t => t.class === "character" || t.class === "hand").map(t => ({ trackId: t.trackId, instanceId: t.instanceId, keypoints: t.annotations.flatMap(a => a.keypoints ?? []) }));
}

export function tracksToPhysicsInputs(tracks: VideoTrack[]) {
  return tracks.filter(t => ["clothing", "hair", "prop", "environment"].includes(t.class)).map(t => ({ trackId: t.trackId, instanceId: t.instanceId, class: t.class, masks: t.annotations.map(a => a.maskRef).filter(Boolean) }));
}

export function tracksToQCInputs(tracks: VideoTrack[]) {
  return tracks.map(t => ({ trackId: t.trackId, class: t.class, confidence: t.confidence, approved: t.approved, warnings: validateTrack(t) }));
}

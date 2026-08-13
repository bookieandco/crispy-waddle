export type TrackingKind = "face" | "body" | "hands" | "full_body" | "voice";
export type PerformanceSampleKind = "pose" | "face_landmarks" | "audio" | "expression";

export interface JointTransform {
  joint: string;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w?: number };
  confidence?: number;
}

export interface PerformanceSample {
  timestampMs: number;
  kind: PerformanceSampleKind;
  joints?: JointTransform[];
  blendshapes?: Record<string, number>;
  audioLevel?: number;
  metadata?: Record<string, string>;
}

export interface PerformanceCapture {
  id: string;
  source: "camera" | "video" | "sensor" | "audio" | "manual";
  tracking: TrackingKind[];
  startedAt: string;
  durationMs: number;
  samples: PerformanceSample[];
  provenance?: string;
}

export interface CharacterPerformanceMapping {
  characterId: string;
  captureId: string;
  rootJoint?: string;
  jointMap?: Record<string, string>;
  blendshapeMap?: Record<string, string>;
  preserveIdentity?: boolean;
}

export interface PerformanceAdapterRequest {
  capture: PerformanceCapture;
  mapping?: CharacterPerformanceMapping;
  targetCharacterId?: string;
}

export interface PerformanceAdapterResult {
  captureId: string;
  characterId?: string;
  animationUri?: string;
  facialAnimationUri?: string;
  metadata?: Record<string, string>;
}

/** Provider-neutral performance capture contract. Concrete mocap/face systems live in adapters. */
export interface PerformanceCaptureAdapter {
  readonly id: string;
  readonly tracking: TrackingKind[];
  canCapture(kind: TrackingKind): boolean | Promise<boolean>;
  capture(request: PerformanceAdapterRequest): Promise<PerformanceAdapterResult>;
}

export interface PerformanceAdapterRegistry {
  adapters: PerformanceCaptureAdapter[];
  find(kind: TrackingKind): PerformanceCaptureAdapter[];
}

export const performanceAdapterRegistry = (adapters: PerformanceCaptureAdapter[]): PerformanceAdapterRegistry => ({
  adapters,
  find: (kind) => adapters.filter((adapter) => adapter.tracking.includes(kind)),
});

export function validatePerformanceCapture(capture: PerformanceCapture): string[] {
  const issues: string[] = [];
  if (capture.durationMs < 0) issues.push("durationMs must be non-negative");
  for (let i = 1; i < capture.samples.length; i += 1) {
    if (capture.samples[i].timestampMs < capture.samples[i - 1].timestampMs) {
      issues.push("samples must be ordered by timestampMs");
      break;
    }
  }
  return issues;
}

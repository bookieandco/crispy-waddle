import type { RestorationEvidence } from "./types.js";

export type DamageType =
  | "click"
  | "crackle"
  | "pop"
  | "dropout"
  | "mute"
  | "clipping"
  | "digital-distortion"
  | "tape-distortion"
  | "hum"
  | "buzz"
  | "hiss"
  | "broadband-noise"
  | "impulse-noise"
  | "spectral-hole"
  | "excess-reverb"
  | "wow"
  | "flutter"
  | "pitch-corruption"
  | "timing-corruption"
  | "phase-corruption"
  | "channel-drop"
  | "stereo-imbalance"
  | "transient-damage"
  | "vocal-artifact"
  | "unknown";

export interface DamageAssessment {
  id: string;
  sourceArtifactId: string;
  type: DamageType;
  severity: number;
  confidence: number;
  waveformScore?: number;
  spectralScore?: number;
  temporalScore?: number;
  channelScore?: number;
  contextualScore?: number;
  musicalScore?: number;
  intentionalityScore?: number;
  region?: { startSample: number; endSample: number };
  evidenceIds: string[];
  reasons: string[];
  repairRecommended: boolean;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function assessDamage(input: {
  sourceArtifactId: string;
  evidence: RestorationEvidence[];
  type: DamageType;
  severity: number;
  confidence: number;
  region?: { startSample: number; endSample: number };
  reasons?: string[];
}): DamageAssessment {
  const evidenceConfidence = input.evidence.length
    ? input.evidence.reduce((sum, item) => sum + clamp01(item.confidence), 0) / input.evidence.length
    : 0;
  const confidence = clamp01(Math.min(input.confidence, evidenceConfidence || input.confidence));
  const severity = clamp01(input.severity);

  return {
    id: `damage:${input.sourceArtifactId}:${input.type}:${input.region?.startSample ?? 0}`,
    sourceArtifactId: input.sourceArtifactId,
    type: input.type,
    severity,
    confidence,
    region: input.region,
    evidenceIds: input.evidence.map((item) => item.id),
    reasons: input.reasons ?? [],
    repairRecommended: confidence >= 0.8 && severity >= 0.2,
  };
}

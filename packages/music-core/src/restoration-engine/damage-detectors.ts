import type { EvidenceObservation } from "./evidence-engine.js";
import type { DamageAssessment, DamageType } from "./damage-assessment.js";

export interface DamageDetectorInput {
  sourceArtifactId: string;
  observations: EvidenceObservation[];
}

export interface DamageDetector {
  readonly id: string;
  readonly version: string;
  readonly type: DamageType;
  detect(input: DamageDetectorInput): DamageAssessment[];
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const observationsOf = (input: DamageDetectorInput, kind: string): EvidenceObservation[] =>
  input.observations.filter((observation) => observation.kind === kind);

const numeric = (observation: EvidenceObservation, key: string): number | null => {
  const value = observation.data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const assessment = (
  input: DamageDetectorInput,
  detector: DamageDetector,
  observation: EvidenceObservation,
  severity: number,
  confidence: number,
  reason: string,
): DamageAssessment => ({
  id: `damage:${input.sourceArtifactId}:${detector.type}:${observation.region?.startSample ?? 0}`,
  sourceArtifactId: input.sourceArtifactId,
  type: detector.type,
  severity: clamp01(severity),
  confidence: clamp01(confidence),
  region: observation.region,
  evidenceIds: [observation.id],
  reasons: [reason],
  repairRecommended: false,
});

/**
 * Conservative impulse detector. A large short-window peak/crest factor is
 * evidence of an impulse, not proof that the transient is unwanted.
 */
export class ImpulseDamageDetector implements DamageDetector {
  readonly id = "damage-detector.impulse";
  readonly version = "1.0.0";
  readonly type: DamageType = "impulse-noise";

  detect(input: DamageDetectorInput): DamageAssessment[] {
    return observationsOf(input, "audio.time-domain").flatMap((observation) => {
      const resolution = observation.data.resolution;
      if (resolution !== "short") return [];
      const crest = numeric(observation, "crestFactor");
      const transient = numeric(observation, "transientScore");
      if (crest === null || transient === null || crest < 6 || transient < 0.75) return [];
      return [assessment(input, this, observation, Math.min(1, transient), Math.min(0.9, observation.confidence * 0.85), "Short-window transient and crest-factor anomaly; musical-transient verification remains required.")];
    });
  }
}

/**
 * Conservative dropout detector. A near-silent run is only a candidate when
 * surrounded by evidence of active signal; intentional silence is not damage.
 */
export class DropoutDamageDetector implements DamageDetector {
  readonly id = "damage-detector.dropout";
  readonly version = "1.0.0";
  readonly type: DamageType = "dropout";

  detect(input: DamageDetectorInput): DamageAssessment[] {
    return observationsOf(input, "audio.time-domain").flatMap((observation) => {
      if (observation.data.resolution !== "long") return [];
      const rms = numeric(observation, "rms");
      const active = numeric(observation, "neighborActivity");
      if (rms === null || active === null || rms > 0.001 || active < 0.5) return [];
      return [assessment(input, this, observation, 0.7, Math.min(0.85, observation.confidence), "Long-window near-silence with surrounding activity; intentional musical silence must be excluded before repair.")];
    });
  }
}

/**
 * Detects possible hard clipping from calibration evidence. It reports an
 * observation only; analog saturation and intentional overload require
 * contextual review.
 */
export class ClippingDamageDetector implements DamageDetector {
  readonly id = "damage-detector.clipping";
  readonly version = "1.0.0";
  readonly type: DamageType = "clipping";

  detect(input: DamageDetectorInput): DamageAssessment[] {
    return observationsOf(input, "audio.calibration").flatMap((observation) => {
      const clipped = numeric(observation, "clippingIndicators");
      const sampleCount = numeric(observation, "sampleCount");
      if (clipped === null || sampleCount === null || sampleCount <= 0 || clipped === 0) return [];
      const ratio = clipped / sampleCount;
      return [assessment(input, this, observation, Math.min(1, ratio * 100), Math.min(0.95, observation.confidence), "Full-scale sample observations indicate possible clipping; intentional saturation and transfer characteristics require contextual validation.")];
    });
  }
}

export class SpecializedDamageDetectorEngine {
  constructor(private readonly detectors: DamageDetector[] = [
    new ImpulseDamageDetector(),
    new DropoutDamageDetector(),
    new ClippingDamageDetector(),
  ]) {}

  detect(input: DamageDetectorInput): DamageAssessment[] {
    return this.detectors.flatMap((detector) => detector.detect(input));
  }
}

import type { DamageType } from "./damage-assessment.js";
import type { EvidenceObservation } from "./evidence-engine.js";

export interface LocalBaseline {
  region: { startSample: number; endSample: number };
  medianConfidence: number;
  observationCount: number;
  deviation: number;
}

export interface IntentionalityAssessment {
  likelihood: number;
  confidence: number;
  reasons: string[];
  abstained: boolean;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const regionLength = (region: { startSample: number; endSample: number }): number =>
  Math.max(0, region.endSample - region.startSample);

/** Builds a descriptive baseline from observations. It never changes audio. */
export function buildLocalBaseline(observations: EvidenceObservation[]): LocalBaseline | null {
  if (!observations.length) return null;

  const starts = observations.map((item) => item.region?.startSample ?? 0);
  const ends = observations.map((item) => item.region?.endSample ?? 0);
  const confidences = observations.map((item) => clamp01(item.confidence));
  const region = {
    startSample: Math.min(...starts),
    endSample: Math.max(...ends),
  };

  const deviation = confidences.length > 1
    ? clamp01(Math.abs(Math.max(...confidences) - median(confidences)))
    : 0;

  return {
    region,
    medianConfidence: median(confidences),
    observationCount: observations.length,
    deviation,
  };
}

/**
 * Intentionality is deliberately separate from damage severity.
 * Unusual material may be intentional performance, production, or source character.
 */
export function assessIntentionality(input: {
  type: DamageType;
  observations: EvidenceObservation[];
  baseline?: LocalBaseline | null;
}): IntentionalityAssessment {
  const baseline = input.baseline ?? buildLocalBaseline(input.observations);
  const observationConfidence = input.observations.length
    ? median(input.observations.map((item) => clamp01(item.confidence)))
    : 0;

  if (!baseline || !input.observations.length) {
    return {
      likelihood: 0,
      confidence: 0,
      reasons: ["Insufficient local evidence to distinguish damage from intentional source character."],
      abstained: true,
    };
  }

  const shortRegion = regionLength(baseline.region) > 0 && regionLength(baseline.region) < 0.05 * Math.max(1, regionLength(baseline.region));
  const unusual = baseline.deviation > 0.25;
  const contextualKinds = new Set(["audio.musical", "audio.symbolic", "audio.contextual"]);
  const contextualEvidence = input.observations.some((item) => contextualKinds.has(item.kind));

  let likelihood = 0.25;
  const reasons = ["Intentionality is treated as an independent hypothesis, not as the inverse of damage severity."];

  if (contextualEvidence) {
    likelihood += 0.2;
    reasons.push("Contextual or musical evidence is present.");
  }
  if (unusual) {
    likelihood += 0.15;
    reasons.push("The observation differs from the local confidence baseline.");
  }
  if (shortRegion) {
    likelihood += 0.05;
    reasons.push("The evidence is localized; short anomalies require additional corroboration.");
  }

  likelihood = clamp01(likelihood);
  const confidence = clamp01(0.5 * observationConfidence + 0.5 * baseline.medianConfidence);

  return {
    likelihood,
    confidence,
    reasons,
    abstained: confidence < 0.6 || Math.abs(likelihood - 0.5) < 0.1,
  };
}

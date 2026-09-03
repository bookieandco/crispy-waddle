import type { DamageAssessment, DamageType } from "./damage-assessment.js";
import type { RestorationAudioInput } from "./audio-input.js";
import type { EvidenceBundle, EvidenceObservation } from "./evidence-engine.js";

export interface DamageSignalScores {
  waveform: number;
  spectral: number;
  temporal: number;
  channel: number;
  contextual: number;
}

export interface DamageHypothesis {
  type: DamageType;
  region: { startSample: number; endSample: number };
  severity: number;
  confidence: number;
  scores: DamageSignalScores;
  evidenceIds: string[];
  reasons: string[];
}

export interface MultiSignalDamageResult {
  sourceArtifactId: string;
  hypotheses: DamageHypothesis[];
  abstained: boolean;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const numberValue = (observation: EvidenceObservation, key: string): number | null => {
  const value = observation.data[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const regionOf = (observation: EvidenceObservation) =>
  observation.region ?? { startSample: 0, endSample: 0 };

const scoreForKind = (observations: EvidenceObservation[], kinds: string[]): number => {
  const selected = observations.filter((item) => kinds.includes(item.kind));
  if (!selected.length) return 0;
  return selected.reduce((sum, item) => sum + clamp01(item.confidence), 0) / selected.length;
};

/**
 * Conservative evidence fusion. This layer creates hypotheses only; it does not
 * authorize a repair. A single anomalous observation is never sufficient.
 */
export function detectDamageHypotheses(
  input: RestorationAudioInput,
  evidence: EvidenceBundle,
): MultiSignalDamageResult {
  const observations = evidence.observations as EvidenceObservation[];
  const hypotheses: DamageHypothesis[] = [];

  const temporal = scoreForKind(observations, ["audio.time-domain", "audio.temporal"]);
  const spectral = scoreForKind(observations, ["audio.spectral"]);
  const waveform = scoreForKind(observations, ["audio.calibration"]);

  const channels = new Set(
    observations
      .map((item) => numberValue(item, "channel"))
      .filter((value): value is number => value !== null),
  );
  const channel = channels.size > 1 ? 0.5 : 0;

  const allRegion = {
    startSample: input.startSample ?? 0,
    endSample: (input.startSample ?? 0) + (input.channels[0]?.length ?? 0),
  };

  if (temporal > 0 && spectral > 0) {
    const confidence = clamp01(0.55 * temporal + 0.45 * spectral);
    hypotheses.push({
      type: "unknown",
      region: allRegion,
      severity: clamp01(Math.max(temporal, spectral)),
      confidence,
      scores: { waveform, spectral, temporal, channel, contextual: 0 },
      evidenceIds: observations.map((item) => item.id),
      reasons: ["Temporal and spectral evidence are present; defect class requires specialized detectors."],
    });
  }

  return {
    sourceArtifactId: input.sourceArtifactId,
    hypotheses,
    abstained: hypotheses.length === 0 || hypotheses.every((item) => item.confidence < 0.8),
  };
}

export function toDamageAssessments(result: MultiSignalDamageResult): DamageAssessment[] {
  return result.hypotheses.map((hypothesis, index) => ({
    id: `damage:${result.sourceArtifactId}:${hypothesis.type}:${hypothesis.region.startSample}:${index}`,
    sourceArtifactId: result.sourceArtifactId,
    type: hypothesis.type,
    severity: hypothesis.severity,
    confidence: hypothesis.confidence,
    waveformScore: hypothesis.scores.waveform,
    spectralScore: hypothesis.scores.spectral,
    temporalScore: hypothesis.scores.temporal,
    channelScore: hypothesis.scores.channel,
    contextualScore: hypothesis.scores.contextual,
    region: hypothesis.region,
    evidenceIds: hypothesis.evidenceIds,
    reasons: hypothesis.reasons,
    repairRecommended: false,
  }));
}

export function evidenceRegion(observation: EvidenceObservation) {
  return regionOf(observation);
}

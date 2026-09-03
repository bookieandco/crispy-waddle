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

const regionOverlap = (
  a: { startSample: number; endSample: number },
  b: { startSample: number; endSample: number },
): number => {
  const start = Math.max(a.startSample, b.startSample);
  const end = Math.min(a.endSample, b.endSample);
  const overlap = Math.max(0, end - start);
  const union = Math.max(a.endSample, b.endSample) - Math.min(a.startSample, b.startSample);
  return union > 0 ? overlap / union : 0;
};

const corroboratedRegion = (
  observations: EvidenceObservation[],
): { region: { startSample: number; endSample: number }; evidenceIds: string[] } | null => {
  const usable = observations.filter((item) => item.region && item.region.endSample > item.region.startSample);
  if (usable.length < 2) return null;

  for (const anchor of usable) {
    const matches = usable.filter(
      (item) => item.id !== anchor.id && regionOverlap(anchor.region!, item.region!) >= 0.5,
    );
    if (!matches.length) continue;

    const start = Math.max(anchor.region!.startSample, ...matches.map((item) => item.region!.startSample));
    const end = Math.min(anchor.region!.endSample, ...matches.map((item) => item.region!.endSample));
    if (end <= start) continue;

    return {
      region: { startSample: start, endSample: end },
      evidenceIds: [anchor, ...matches].map((item) => item.id),
    };
  }
  return null;
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
  const corroboration = corroboratedRegion(observations);

  if (!corroboration || temporal <= 0 || spectral <= 0) {
    return { sourceArtifactId: input.sourceArtifactId, hypotheses: [], abstained: true };
  }

  const confidence = clamp01(0.35 * temporal + 0.35 * spectral + 0.30 *
    clamp01(corroboration.evidenceIds.length / Math.max(2, observations.length)));

  hypotheses.push({
    type: "unknown",
    region: corroboration.region,
    severity: clamp01(Math.max(temporal, spectral)),
    confidence,
    scores: {
      waveform,
      spectral,
      temporal,
      channel: new Set(
        observations
          .map((item) => numberValue(item, "channel"))
          .filter((value): value is number => value !== null),
      ).size > 1 ? 0.5 : 0,
      contextual: 0,
    },
    evidenceIds: corroboration.evidenceIds,
    reasons: [
      "Temporal and spectral observations overlap in the same region.",
      "Hypothesis remains unclassified until a specialized detector identifies the defect type.",
    ],
  });

  return {
    sourceArtifactId: input.sourceArtifactId,
    hypotheses,
    abstained: hypotheses.every((item) => item.confidence < 0.8),
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
    evidenceIds: hypothesis.evidenceIds,
    reasons: hypothesis.reasons,
    region: hypothesis.region,
    repairRecommended: false,
  }));
}

export function evidenceRegion(observation: EvidenceObservation) {
  return regionOf(observation);
}

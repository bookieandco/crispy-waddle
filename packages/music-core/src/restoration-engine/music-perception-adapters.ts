import type { EvidenceObservation } from "./evidence-engine.js";

export type MusicPerceptionAdapterId = "audioflux" | "omnizart" | "muse-benchmark";

export interface MusicPerceptionAdapterContext {
  sourceArtifactId: string;
  sourceVersionId: string;
  caseId: string;
  startSample: number;
  endSample: number;
}

export interface AudioFluxFeatureObservation {
  feature: string;
  values: number[];
  sampleRate?: number;
  hopSamples?: number;
  confidence?: number;
}

export interface OmnizartTranscriptionObservation {
  kind: "music" | "drum" | "chord" | "vocal" | "vocal-contour" | "beat";
  events: Array<Record<string, unknown>>;
  confidence?: number;
}

export interface MuseTrialResult {
  task: string;
  correct: boolean;
  model: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

const boundedConfidence = (value: number | undefined): number => {
  if (value === undefined) return 0.5;
  if (!Number.isFinite(value)) throw new Error("Perception confidence must be finite");
  return Math.max(0, Math.min(1, value));
};

const validateContext = (context: MusicPerceptionAdapterContext): void => {
  if (!context.sourceArtifactId || !context.sourceVersionId || !context.caseId) {
    throw new Error("Music perception adapter context identity is required");
  }
  if (!Number.isInteger(context.startSample) || !Number.isInteger(context.endSample) || context.endSample <= context.startSample) {
    throw new Error("Music perception adapter sample region is invalid");
  }
};

/** Converts AudioFlux feature output into evidence without treating features as restoration decisions. */
export function audioFluxToEvidence(
  context: MusicPerceptionAdapterContext,
  observations: AudioFluxFeatureObservation[],
): EvidenceObservation[] {
  validateContext(context);
  return observations.map((observation, index) => {
    if (!observation.feature || !Array.isArray(observation.values) || observation.values.some((value) => !Number.isFinite(value))) {
      throw new Error("AudioFlux feature observations must contain finite numeric values");
    }
    return {
      id: `audioflux:${context.sourceArtifactId}:${context.startSample}:${index}:${observation.feature}`,
      kind: `audioflux.${observation.feature}`,
      confidence: boundedConfidence(observation.confidence),
      sourceArtifactId: context.sourceArtifactId,
      region: { startSample: context.startSample, endSample: context.endSample },
      data: {
        sourceVersionId: context.sourceVersionId,
        caseId: context.caseId,
        feature: observation.feature,
        valuesJson: JSON.stringify(observation.values),
        sampleRate: observation.sampleRate ?? 0,
        hopSamples: observation.hopSamples ?? 0,
      },
    };
  });
}

/** Converts Omnizart transcription into evidence-bearing musical structure observations. */
export function omnizartToEvidence(
  context: MusicPerceptionAdapterContext,
  observations: OmnizartTranscriptionObservation[],
): EvidenceObservation[] {
  validateContext(context);
  return observations.map((observation, index) => {
    if (!observation.kind || !Array.isArray(observation.events)) throw new Error("Omnizart observations are invalid");
    return {
      id: `omnizart:${context.sourceArtifactId}:${context.startSample}:${index}:${observation.kind}`,
      kind: `omnizart.${observation.kind}`,
      confidence: boundedConfidence(observation.confidence),
      sourceArtifactId: context.sourceArtifactId,
      region: { startSample: context.startSample, endSample: context.endSample },
      data: {
        sourceVersionId: context.sourceVersionId,
        caseId: context.caseId,
        eventCount: observation.events.length,
        eventsJson: JSON.stringify(observation.events),
      },
    };
  });
}

/**
 * MUSE is an evaluation oracle, not training data and not a restoration model.
 * The benchmark stimuli remain outside this package because the repository's
 * dataset license permits testing but prohibits commercial use and training.
 */
export function museTrialToEvidence(
  context: MusicPerceptionAdapterContext,
  result: MuseTrialResult,
): EvidenceObservation {
  validateContext(context);
  if (!result.task || !result.model || typeof result.correct !== "boolean") {
    throw new Error("MUSE trial result is invalid");
  }
  return {
    id: `muse:${context.sourceArtifactId}:${context.startSample}:${result.task}:${result.model}`,
    kind: `benchmark.muse.${result.task}`,
    confidence: boundedConfidence(result.confidence),
    sourceArtifactId: context.sourceArtifactId,
    region: { startSample: context.startSample, endSample: context.endSample },
    data: {
      sourceVersionId: context.sourceVersionId,
      caseId: context.caseId,
      model: result.model,
      correct: result.correct ? 1 : 0,
      metadataJson: JSON.stringify(result.metadata ?? {}),
    },
  };
}

export const MUSE_TASKS = [
  "instrument-id",
  "melody-shape",
  "oddball-detection",
  "rhythm-matching",
  "pitch-shift-detection",
  "chord-quality",
  "key-modulation",
  "chord-sequence-matching",
  "syncopation",
  "meter",
] as const;

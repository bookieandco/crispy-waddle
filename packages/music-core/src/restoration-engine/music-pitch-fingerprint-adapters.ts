import type { EvidenceObservation } from "./evidence-engine.js";
import type { MusicPerceptionAdapterContext } from "./music-perception-adapters.js";

export interface CrepePitchObservation {
  timeSeconds: number;
  frequencyHz: number;
  confidence: number;
}

export interface OlafFingerprintMatch {
  referenceId: string;
  score: number;
  queryStartSample?: number;
  referenceStartSample?: number;
  offsetSamples?: number;
}

const finiteProbability = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be between 0 and 1`);
  return value;
};

const validateContext = (context: MusicPerceptionAdapterContext): void => {
  if (!context.sourceArtifactId || !context.sourceVersionId || !context.caseId) {
    throw new Error("Music pitch/fingerprint adapter context identity is required");
  }
  if (!Number.isInteger(context.startSample) || !Number.isInteger(context.endSample) || context.endSample <= context.startSample) {
    throw new Error("Music pitch/fingerprint adapter sample region is invalid");
  }
};

/** CREPE contributes fundamental-frequency evidence; it never decides whether a pitch is damaged. */
export function crepeToEvidence(
  context: MusicPerceptionAdapterContext,
  observations: CrepePitchObservation[],
): EvidenceObservation {
  validateContext(context);
  if (observations.length === 0) throw new Error("CREPE observations are required");
  for (const observation of observations) {
    if (!Number.isFinite(observation.timeSeconds) || observation.timeSeconds < 0) throw new Error("CREPE time is invalid");
    if (!Number.isFinite(observation.frequencyHz) || observation.frequencyHz < 0) throw new Error("CREPE frequency is invalid");
    finiteProbability(observation.confidence, "CREPE confidence");
  }
  const meanConfidence = observations.reduce((sum, observation) => sum + observation.confidence, 0) / observations.length;
  return {
    id: `crepe:${context.sourceArtifactId}:${context.startSample}:${context.endSample}`,
    kind: "pitch.crepe",
    confidence: meanConfidence,
    sourceArtifactId: context.sourceArtifactId,
    region: { startSample: context.startSample, endSample: context.endSample },
    data: {
      sourceVersionId: context.sourceVersionId,
      caseId: context.caseId,
      observationCount: observations.length,
      observationsJson: JSON.stringify(observations),
    },
  };
}

/** Olaf matches are correspondence evidence, not proof that a matched source is the historical original. */
export function olafMatchesToEvidence(
  context: MusicPerceptionAdapterContext,
  matches: OlafFingerprintMatch[],
): EvidenceObservation[] {
  validateContext(context);
  return matches.map((match, index) => {
    if (!match.referenceId) throw new Error("Olaf reference ID is required");
    finiteProbability(match.score, "Olaf match score");
    for (const value of [match.queryStartSample, match.referenceStartSample, match.offsetSamples]) {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) throw new Error("Olaf sample coordinates are invalid");
    }
    return {
      id: `olaf:${context.sourceArtifactId}:${context.startSample}:${index}:${match.referenceId}`,
      kind: "correspondence.olaf",
      confidence: match.score,
      sourceArtifactId: context.sourceArtifactId,
      region: { startSample: context.startSample, endSample: context.endSample },
      data: {
        sourceVersionId: context.sourceVersionId,
        caseId: context.caseId,
        referenceId: match.referenceId,
        score: match.score,
        queryStartSample: match.queryStartSample ?? -1,
        referenceStartSample: match.referenceStartSample ?? -1,
        offsetSamples: match.offsetSamples ?? 0,
      },
    };
  });
}

export type InstrumentFamily =
  | "acoustic-guitar" | "electric-guitar" | "piano" | "organ" | "strings"
  | "brass" | "woodwinds" | "drums" | "bass" | "percussion" | "synth" | "unknown";

export interface InstrumentFingerprint {
  family: InstrumentFamily;
  spectralCentroidHz: number;
  spectralSpreadHz: number;
  lowEnergyRatio: number;
  midEnergyRatio: number;
  highEnergyRatio: number;
  transientStrength: number;
  harmonicity: number;
  pitchRangeHz?: { min: number; max: number };
  stereoWidth?: number;
  dynamicRangeDb?: number;
}

export interface InstrumentReplacementCandidate {
  id: string;
  label: string;
  fingerprint: InstrumentFingerprint;
  sourceArtifactId: string;
  replacementArtifactId: string;
}

export interface RestorationGainEvidence {
  /** How the gain estimate was produced; retained for audit/ledger records. */
  method: string;
  expectedGain: number;
  confidence: number;
}

export interface InstrumentReplacementDecision {
  replace: boolean;
  confidence: number;
  fingerprintSimilarity: number;
  expectedRestorationGain: number;
  gainEvidenceConfidence: number;
  reason: string;
  requiresApproval: true;
  candidateId?: string;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const distance = (a: number, b: number, scale: number): number =>
  Math.min(1, Math.abs(a - b) / Math.max(scale, Number.EPSILON));

function assertFingerprint(fingerprint: InstrumentFingerprint, label: string): void {
  const bounded = [
    ["lowEnergyRatio", fingerprint.lowEnergyRatio],
    ["midEnergyRatio", fingerprint.midEnergyRatio],
    ["highEnergyRatio", fingerprint.highEnergyRatio],
    ["transientStrength", fingerprint.transientStrength],
    ["harmonicity", fingerprint.harmonicity],
  ] as const;
  if (!Number.isFinite(fingerprint.spectralCentroidHz) || fingerprint.spectralCentroidHz < 0) {
    throw new Error(`${label}.spectralCentroidHz must be finite and >= 0`);
  }
  if (!Number.isFinite(fingerprint.spectralSpreadHz) || fingerprint.spectralSpreadHz < 0) {
    throw new Error(`${label}.spectralSpreadHz must be finite and >= 0`);
  }
  for (const [name, value] of bounded) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`${label}.${name} must be finite and between 0 and 1`);
    }
  }
  if (fingerprint.pitchRangeHz &&
      (!Number.isFinite(fingerprint.pitchRangeHz.min) ||
       !Number.isFinite(fingerprint.pitchRangeHz.max) ||
       fingerprint.pitchRangeHz.min < 0 ||
       fingerprint.pitchRangeHz.max < fingerprint.pitchRangeHz.min)) {
    throw new Error(`${label}.pitchRangeHz is invalid`);
  }
  if (fingerprint.stereoWidth !== undefined &&
      (!Number.isFinite(fingerprint.stereoWidth) || fingerprint.stereoWidth < 0 || fingerprint.stereoWidth > 1)) {
    throw new Error(`${label}.stereoWidth must be between 0 and 1`);
  }
  if (fingerprint.dynamicRangeDb !== undefined &&
      (!Number.isFinite(fingerprint.dynamicRangeDb) || fingerprint.dynamicRangeDb < 0)) {
    throw new Error(`${label}.dynamicRangeDb must be >= 0`);
  }
}

/** Compare timbral fingerprints without replacing the original audio. */
export function compareInstrumentFingerprints(
  observed: InstrumentFingerprint,
  candidate: InstrumentFingerprint,
): number {
  assertFingerprint(observed, "observed");
  assertFingerprint(candidate, "candidate");
  const spectral = 1 - distance(observed.spectralCentroidHz, candidate.spectralCentroidHz, 4000);
  const spread = 1 - distance(observed.spectralSpreadHz, candidate.spectralSpreadHz, 5000);
  const low = 1 - Math.abs(observed.lowEnergyRatio - candidate.lowEnergyRatio);
  const mid = 1 - Math.abs(observed.midEnergyRatio - candidate.midEnergyRatio);
  const high = 1 - Math.abs(observed.highEnergyRatio - candidate.highEnergyRatio);
  const transient = 1 - Math.abs(observed.transientStrength - candidate.transientStrength);
  const harmonic = 1 - Math.abs(observed.harmonicity - candidate.harmonicity);
  const family = observed.family === candidate.family ? 1 : 0;
  return clamp01(spectral * 0.22 + spread * 0.10 + low * 0.10 + mid * 0.10 + high * 0.10 + transient * 0.12 + harmonic * 0.11 + family * 0.15);
}

/**
 * Decide whether replacing an instrument is likely to improve restoration.
 * This function never renders or mutates audio. Replacement is always a human-approved operation.
 */
export function decideInstrumentReplacement(args: {
  observed: InstrumentFingerprint;
  candidate: InstrumentReplacementCandidate;
  gainEvidence: RestorationGainEvidence;
  minimumSimilarity?: number;
  minimumGain?: number;
  minimumGainConfidence?: number;
}): InstrumentReplacementDecision {
  assertFingerprint(args.observed, "observed");
  assertFingerprint(args.candidate.fingerprint, "candidate.fingerprint");
  if (!args.candidate.id || !args.candidate.replacementArtifactId) {
    throw new Error("candidate must identify a replacement artifact");
  }
  if (args.candidate.sourceArtifactId === args.candidate.replacementArtifactId) {
    throw new Error("replacement artifact must differ from the damaged source artifact");
  }
  if (!Number.isFinite(args.gainEvidence.expectedGain) || args.gainEvidence.expectedGain < 0 || args.gainEvidence.expectedGain > 1) {
    throw new Error("gainEvidence.expectedGain must be between 0 and 1");
  }
  if (!Number.isFinite(args.gainEvidence.confidence) || args.gainEvidence.confidence < 0 || args.gainEvidence.confidence > 1) {
    throw new Error("gainEvidence.confidence must be between 0 and 1");
  }

  const minimumSimilarity = args.minimumSimilarity ?? 0.82;
  const minimumGain = args.minimumGain ?? 0.15;
  const minimumGainConfidence = args.minimumGainConfidence ?? 0.70;
  if (minimumSimilarity < 0 || minimumSimilarity > 1 || minimumGain < 0 || minimumGain > 1 || minimumGainConfidence < 0 || minimumGainConfidence > 1) {
    throw new Error("decision thresholds must be between 0 and 1");
  }

  const fingerprintSimilarity = compareInstrumentFingerprints(args.observed, args.candidate.fingerprint);
  const gain = args.gainEvidence.expectedGain;
  const familyMatch = args.observed.family === args.candidate.fingerprint.family;
  const replace = familyMatch &&
    fingerprintSimilarity >= minimumSimilarity &&
    gain >= minimumGain &&
    args.gainEvidence.confidence >= minimumGainConfidence;

  const rejectionReasons: string[] = [];
  if (!familyMatch) rejectionReasons.push("instrument family does not match");
  if (fingerprintSimilarity < minimumSimilarity) rejectionReasons.push(`fingerprint similarity ${fingerprintSimilarity.toFixed(2)} is below ${minimumSimilarity.toFixed(2)}`);
  if (gain < minimumGain) rejectionReasons.push(`estimated restoration gain ${gain.toFixed(2)} is below ${minimumGain.toFixed(2)}`);
  if (args.gainEvidence.confidence < minimumGainConfidence) rejectionReasons.push(`gain evidence confidence ${args.gainEvidence.confidence.toFixed(2)} is below ${minimumGainConfidence.toFixed(2)}`);

  return {
    replace,
    confidence: clamp01(fingerprintSimilarity * 0.55 + gain * 0.25 + args.gainEvidence.confidence * 0.20),
    fingerprintSimilarity,
    expectedRestorationGain: gain,
    gainEvidenceConfidence: args.gainEvidence.confidence,
    reason: replace
      ? `Candidate preserves the instrument fingerprint (${fingerprintSimilarity.toFixed(2)}) and has estimated restoration gain ${gain.toFixed(2)} with evidence confidence ${args.gainEvidence.confidence.toFixed(2)}.`
      : `Replacement rejected: ${rejectionReasons.join("; ")}.`,
    requiresApproval: true,
    candidateId: replace ? args.candidate.id : undefined,
  };
}

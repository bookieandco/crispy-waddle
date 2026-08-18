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

export interface InstrumentReplacementDecision {
  replace: boolean;
  confidence: number;
  fingerprintSimilarity: number;
  expectedRestorationGain: number;
  reason: string;
  requiresApproval: true;
  candidateId?: string;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const distance = (a: number, b: number, scale: number): number =>
  Math.min(1, Math.abs(a - b) / Math.max(scale, Number.EPSILON));

/** Compare timbral fingerprints without replacing the original audio. */
export function compareInstrumentFingerprints(
  observed: InstrumentFingerprint,
  candidate: InstrumentFingerprint,
): number {
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

/** Decide whether replacing an instrument is likely to improve restoration. */
export function decideInstrumentReplacement(args: {
  observed: InstrumentFingerprint;
  candidate: InstrumentReplacementCandidate;
  expectedRestorationGain: number;
  minimumSimilarity?: number;
  minimumGain?: number;
}): InstrumentReplacementDecision {
  const minimumSimilarity = args.minimumSimilarity ?? 0.82;
  const minimumGain = args.minimumGain ?? 0.15;
  const fingerprintSimilarity = compareInstrumentFingerprints(args.observed, args.candidate.fingerprint);
  const gain = clamp01(args.expectedRestorationGain);
  const replace = fingerprintSimilarity >= minimumSimilarity && gain >= minimumGain;
  return {
    replace,
    confidence: clamp01(fingerprintSimilarity * 0.65 + gain * 0.35),
    fingerprintSimilarity,
    expectedRestorationGain: gain,
    reason: replace
      ? `Candidate preserves the instrument fingerprint (${fingerprintSimilarity.toFixed(2)}) while providing an estimated restoration gain of ${gain.toFixed(2)}.`
      : `Replacement rejected: fingerprint similarity ${fingerprintSimilarity.toFixed(2)} and restoration gain ${gain.toFixed(2)} do not both clear the safety thresholds.`,
    requiresApproval: true,
    candidateId: replace ? args.candidate.id : undefined,
  };
}

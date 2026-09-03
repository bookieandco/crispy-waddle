export type MusicalEventKind =
  | "kick"
  | "snare"
  | "hat"
  | "cymbal"
  | "tom"
  | "percussion"
  | "bass-event"
  | "guitar-event"
  | "keyboard-event"
  | "vocal-transient"
  | "vocal-consonant"
  | "vocal-vowel"
  | "vocal-breath"
  | "plosive"
  | "fricative"
  | "musical-silence"
  | "intentional-distortion"
  | "tape-character"
  | "unknown";

export interface MusicalEventRegion {
  startSample: number;
  endSample: number;
}

export interface MusicalEventObservation {
  id: string;
  sourceArtifactId: string;
  kind: MusicalEventKind;
  region: MusicalEventRegion;
  confidence: number;
  evidenceIds: string[];
  reasons: string[];
  protected: boolean;
  protectionReason?: string;
}

export interface InstrumentReplacementCandidate {
  id: string;
  eventId: string;
  sourceInstrument: MusicalEventKind;
  substituteInstrument: string;
  region: MusicalEventRegion;
  similarityScore: number;
  musicalRoleScore: number;
  timingScore: number;
  timbreScore: number;
  dynamicsScore: number;
  contextScore: number;
  artifactRisk: number;
  authenticityRisk: number;
  provenance: "same-recording" | "external-recording" | "generated" | "unknown";
  preservesOriginalEventTiming: boolean;
  rationale: string[];
}

export interface InstrumentReplacementPolicy {
  allowed: boolean;
  requiresHumanReview: boolean;
  reason: string;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const validRegion = (region: MusicalEventRegion): boolean =>
  Number.isInteger(region.startSample) &&
  Number.isInteger(region.endSample) &&
  region.startSample >= 0 &&
  region.endSample > region.startSample;

/**
 * Normalizes specialist event observations without pretending that a heuristic
 * can identify an instrument or vocal event with certainty.
 */
export function buildEventPerception(input: {
  sourceArtifactId: string;
  observations: Array<Omit<MusicalEventObservation, "sourceArtifactId"> & { sourceArtifactId?: string }>;
}): MusicalEventObservation[] {
  return input.observations
    .filter((event) => (event.sourceArtifactId ?? input.sourceArtifactId) === input.sourceArtifactId)
    .filter((event) => validRegion(event.region))
    .map((event) => ({
      ...event,
      sourceArtifactId: input.sourceArtifactId,
      confidence: clamp01(event.confidence),
      evidenceIds: [...new Set(event.evidenceIds)],
      protected: Boolean(event.protected),
      reasons: [...event.reasons],
    }))
    .sort((a, b) => a.region.startSample - b.region.startSample);
}

/**
 * A replacement is a candidate for Jhadina's judgment, never an automatic edit.
 * External/generated material is explicitly marked as substitute material rather
 * than recovered historical audio.
 */
export function evaluateInstrumentReplacementPolicy(input: {
  event: MusicalEventObservation;
  candidate: InstrumentReplacementCandidate;
  evidenceConfidence: number;
}): InstrumentReplacementPolicy {
  const c = input.candidate;
  if (input.event.protected) {
    return { allowed: false, requiresHumanReview: true, reason: "Protected musical event cannot be silently replaced." };
  }
  if (!c.preservesOriginalEventTiming) {
    return { allowed: false, requiresHumanReview: true, reason: "Replacement does not preserve the original event timing." };
  }
  if (c.artifactRisk >= 0.35) {
    return { allowed: false, requiresHumanReview: true, reason: "Candidate artifact risk is too high." };
  }
  if (c.authenticityRisk >= 0.5) {
    return { allowed: false, requiresHumanReview: true, reason: "Authenticity risk is too high for unattended replacement." };
  }
  const score = 0.25 * clamp01(c.similarityScore) +
    0.2 * clamp01(c.musicalRoleScore) +
    0.15 * clamp01(c.timingScore) +
    0.15 * clamp01(c.timbreScore) +
    0.1 * clamp01(c.dynamicsScore) +
    0.1 * clamp01(c.contextScore) +
    0.05 * clamp01(input.evidenceConfidence);

  if (score < 0.78) {
    return { allowed: false, requiresHumanReview: true, reason: "Replacement candidate does not clear the conservative fidelity threshold." };
  }

  if (c.provenance !== "same-recording") {
    return { allowed: true, requiresHumanReview: true, reason: "A substitute instrument may improve perceptual quality, but non-source provenance requires explicit review." };
  }

  return { allowed: true, requiresHumanReview: false, reason: "Candidate meets the conservative event-level replacement threshold." };
}

/** Returns events whose regions overlap the supplied region. */
export function eventsOverlapping(events: MusicalEventObservation[], region: MusicalEventRegion): MusicalEventObservation[] {
  return events.filter((event) =>
    event.region.startSample < region.endSample &&
    region.startSample < event.region.endSample,
  );
}

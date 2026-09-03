import type { EvidenceObservation } from "./evidence-engine.js";
import type { DamageAssessment } from "./damage-assessment.js";
import type { SampleRegion, ProtectedRegion } from "./damage-region.js";

export type MusicalEventKind =
  | "kick"
  | "snare"
  | "hat"
  | "cymbal"
  | "tom"
  | "percussion"
  | "bass-event"
  | "vocal-transient"
  | "vocal-consonant"
  | "vocal-breath"
  | "vocal-vowel"
  | "plosive"
  | "fricative"
  | "intentional-distortion"
  | "tape-character"
  | "musical-silence"
  | "unknown";

export type ProtectionLevel = "protected" | "review" | "none";

export interface ProtectedMusicalEvent {
  id: string;
  kind: MusicalEventKind;
  region: SampleRegion;
  confidence: number;
  protection: ProtectionLevel;
  evidenceIds: string[];
  reasons: string[];
}

export interface ProtectedEventDetectionInput {
  sourceArtifactId: string;
  observations: EvidenceObservation[];
  assessments?: DamageAssessment[];
  minimumProtectionConfidence?: number;
  minimumReviewConfidence?: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const validRegion = (region?: SampleRegion): region is SampleRegion =>
  !!region && Number.isFinite(region.startSample) && Number.isFinite(region.endSample) && region.endSample > region.startSample;

const overlaps = (a: SampleRegion, b: SampleRegion): boolean =>
  a.startSample < b.endSample && b.startSample < a.endSample;

const eventKind = (observation: EvidenceObservation): MusicalEventKind | null => {
  const raw = observation.data.eventKind ?? observation.data.musicalEventKind;
  if (typeof raw !== "string") return null;
  const supported: MusicalEventKind[] = [
    "kick", "snare", "hat", "cymbal", "tom", "percussion", "bass-event",
    "vocal-transient", "vocal-consonant", "vocal-breath", "vocal-vowel",
    "plosive", "fricative", "intentional-distortion", "tape-character",
    "musical-silence", "unknown",
  ];
  return supported.includes(raw as MusicalEventKind) ? raw as MusicalEventKind : "unknown";
};

/**
 * Converts explicit musical-event evidence into a protection map.
 * This is a guard, not a damage classifier and never authorizes repair.
 */
export function detectProtectedMusicalEvents(input: ProtectedEventDetectionInput): ProtectedMusicalEvent[] {
  const protectAt = clamp01(input.minimumProtectionConfidence ?? 0.8);
  const reviewAt = clamp01(input.minimumReviewConfidence ?? 0.6);

  return input.observations.flatMap((observation) => {
    const region = observation.region;
    const kind = eventKind(observation);
    if (!validRegion(region) || kind === null) return [];

    const confidence = clamp01(observation.confidence);
    const protection: ProtectionLevel = confidence >= protectAt
      ? "protected"
      : confidence >= reviewAt
        ? "review"
        : "none";

    const reasons = [
      `Explicit musical-event evidence identified as ${kind}.`,
      "Musical-event identity is evidence for preservation, not proof of damage.",
    ];

    if (kind === "intentional-distortion" || kind === "tape-character") {
      reasons.push("Source character is explicitly protected from blanket cleanup.");
    }
    if (kind === "musical-silence") {
      reasons.push("Musical silence is protected against dropout-style repair without contrary evidence.");
    }
    if (kind === "vocal-consonant" || kind === "plosive" || kind === "fricative" || kind === "vocal-breath") {
      reasons.push("Vocal articulation/transient material requires conservative treatment and contextual review.");
    }

    return [{
      id: `protected-event:${input.sourceArtifactId}:${observation.id}`,
      kind,
      region,
      confidence,
      protection,
      evidenceIds: [observation.id],
      reasons,
    }];
  });
}

/**
 * Converts protected events into the damage-region boundary representation.
 * Only events at the protected threshold become hard protected regions;
 * review-level events remain visible without silently blocking all repair.
 */
export function protectedRegionsFromEvents(events: ProtectedMusicalEvent[]): ProtectedRegion[] {
  return events
    .filter((event) => event.protection === "protected")
    .map((event) => ({
      ...event.region,
      reason: `Protected musical event: ${event.kind} (${event.id}).`,
    }));
}

/**
 * Hard guard used before a proposed repair is allowed to proceed.
 * Any overlap with a protected event blocks that proposed change.
 */
export function conflictsWithProtectedMusicalEvent(
  changedRegion: SampleRegion,
  events: ProtectedMusicalEvent[],
): boolean {
  if (!validRegion(changedRegion)) return true;
  return events.some((event) => event.protection === "protected" && overlaps(event.region, changedRegion));
}

/**
 * If a damage assessment overlaps a protected event, downgrade it to review.
 * This does not rewrite the assessment or declare the event damaged.
 */
export function protectedEventConflict(input: {
  assessment: DamageAssessment;
  events: ProtectedMusicalEvent[];
}): { conflict: boolean; reasons: string[] } {
  if (!validRegion(input.assessment.region)) {
    return { conflict: false, reasons: [] };
  }

  const conflicts = input.events.filter(
    (event) => event.protection === "protected" && overlaps(event.region, input.assessment.region),
  );

  if (!conflicts.length) return { conflict: false, reasons: [] };

  return {
    conflict: true,
    reasons: conflicts.map(
      (event) => `Damage hypothesis overlaps protected ${event.kind} event ${event.id}; human/contextual review required.`,
    ),
  };
}

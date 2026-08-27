import {
  compareInstrumentFingerprints,
  decideInstrumentReplacement,
  type InstrumentFingerprint,
  type InstrumentReplacementCandidate,
  type InstrumentReplacementDecision,
  type RestorationGainEvidence,
} from "./instrument-replacement.js";

export type ReplacementScope = "full" | "segments";

export interface ReplacementSegment {
  startMs: number;
  endMs: number;
  damageSeverity: number;
}

export interface InstrumentReplacementPlanInput {
  observed: InstrumentFingerprint;
  candidate: InstrumentReplacementCandidate;
  gainEvidence: RestorationGainEvidence;
  damagedSegments: ReplacementSegment[];
  minimumSimilarity?: number;
  minimumGain?: number;
  minimumGainConfidence?: number;
}

export interface InstrumentReplacementPlan {
  decision: InstrumentReplacementDecision;
  scope: ReplacementScope;
  segments: ReplacementSegment[];
  reason: string;
}

function validateSegments(segments: ReplacementSegment[]): void {
  if (segments.length === 0) throw new Error("at least one damaged segment is required");
  let previousEnd = -1;
  for (const segment of segments) {
    if (!Number.isFinite(segment.startMs) || !Number.isFinite(segment.endMs) || segment.startMs < 0 || segment.endMs <= segment.startMs) {
      throw new Error("replacement segments must have finite, non-negative start/end times with end > start");
    }
    if (!Number.isFinite(segment.damageSeverity) || segment.damageSeverity < 0 || segment.damageSeverity > 1) {
      throw new Error("segment damageSeverity must be between 0 and 1");
    }
    if (segment.startMs < previousEnd) throw new Error("replacement segments must not overlap");
    previousEnd = segment.endMs;
  }
}

/**
 * Plans a replacement without rendering or mutating audio.
 * Partial segment replacement is preferred whenever damage is localized.
 */
export function planInstrumentReplacement(args: InstrumentReplacementPlanInput): InstrumentReplacementPlan {
  validateSegments(args.damagedSegments);
  const decision = decideInstrumentReplacement({
    observed: args.observed,
    candidate: args.candidate,
    gainEvidence: args.gainEvidence,
    minimumSimilarity: args.minimumSimilarity,
    minimumGain: args.minimumGain,
    minimumGainConfidence: args.minimumGainConfidence,
  });

  if (!decision.replace) {
    return {
      decision,
      scope: "segments",
      segments: args.damagedSegments,
      reason: decision.reason,
    };
  }

  const localizedDamage = args.damagedSegments.length > 0 && args.damagedSegments.some((segment) => segment.damageSeverity < 1);
  const scope: ReplacementScope = localizedDamage ? "segments" : "full";
  const reason = scope === "segments"
    ? `${decision.reason} Damage is localized, so the planner recommends replacing only the supplied damaged segments.`
    : `${decision.reason} Damage covers the supplied instrument scope, so a full replacement is proposed.`;

  return { decision, scope, segments: args.damagedSegments, reason };
}

export function fingerprintCandidateFit(
  observed: InstrumentFingerprint,
  candidate: InstrumentReplacementCandidate,
): number {
  return compareInstrumentFingerprints(observed, candidate.fingerprint);
}

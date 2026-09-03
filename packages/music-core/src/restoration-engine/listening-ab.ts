import type { ListeningFrame, ListeningFrameRegion } from "./listening-frame.js";

export type ListeningChangeClass = "objective" | "perceptual" | "intent-hypothesis";
export type ListeningComparisonStatus = "improved" | "regressed" | "changed" | "unchanged" | "insufficient-evidence";

export interface ListeningNumericChange {
  metric: string;
  a?: number;
  b?: number;
  delta?: number;
  normalizedDelta?: number;
  class: ListeningChangeClass;
  confidence: number;
  evidenceIds: string[];
}

export interface ListeningDescriptorChange {
  descriptor: string;
  side: "added" | "removed" | "shared";
  class: "perceptual" | "intent-hypothesis";
  confidence: number;
  evidenceIds: string[];
}

export interface ListeningEventChange {
  eventId: string;
  side: "added" | "removed" | "shared";
  confidence: number;
  evidenceIds: string[];
}

export interface ListeningABComparison {
  id: string;
  originalFrameId: string;
  candidateFrameId: string;
  sourceArtifactId: string;
  candidateArtifactId: string;
  region: ListeningFrameRegion;
  status: ListeningComparisonStatus;
  objectiveChanges: ListeningNumericChange[];
  perceptualChanges: ListeningDescriptorChange[];
  intentChanges: ListeningDescriptorChange[];
  eventChanges: ListeningEventChange[];
  anomalyChange: {
    damageEvidenceAdded: string[];
    damageEvidenceRemoved: string[];
    descriptorsAdded: string[];
    descriptorsRemoved: string[];
  };
  improvements: string[];
  regressions: string[];
  unchanged: string[];
  evidenceIds: string[];
  confidence: number;
  abstained: boolean;
  reasons: string[];
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const finite = (value: number | undefined): value is number => typeof value === "number" && Number.isFinite(value);
const unique = (values: string[]): string[] => [...new Set(values)];

function compareNumeric(
  metric: string,
  a: number | undefined,
  b: number | undefined,
  className: ListeningChangeClass,
  confidence: number,
  evidenceIds: string[],
): ListeningNumericChange | undefined {
  if (!finite(a) || !finite(b)) return undefined;
  const delta = b - a;
  const scale = Math.max(Math.abs(a), Math.abs(b), 1e-9);
  return {
    metric,
    a,
    b,
    delta,
    normalizedDelta: delta / scale,
    class: className,
    confidence: clamp01(confidence),
    evidenceIds: unique(evidenceIds),
  };
}

function descriptorDiff(
  a: Array<{ descriptor: string; confidence: number; evidenceIds: string[] }>,
  b: Array<{ descriptor: string; confidence: number; evidenceIds: string[] }>,
  className: "perceptual" | "intent-hypothesis",
): ListeningDescriptorChange[] {
  const aMap = new Map(a.map((item) => [item.descriptor, item]));
  const bMap = new Map(b.map((item) => [item.descriptor, item]));
  const changes: ListeningDescriptorChange[] = [];
  for (const [descriptor, item] of bMap) {
    if (!aMap.has(descriptor)) changes.push({ descriptor, side: "added", class: className, confidence: clamp01(item.confidence), evidenceIds: unique(item.evidenceIds) });
    else changes.push({ descriptor, side: "shared", class: className, confidence: clamp01(Math.min(item.confidence, aMap.get(descriptor)?.confidence ?? 0)), evidenceIds: unique([...item.evidenceIds, ...(aMap.get(descriptor)?.evidenceIds ?? [])]) });
  }
  for (const [descriptor, item] of aMap) {
    if (!bMap.has(descriptor)) changes.push({ descriptor, side: "removed", class: className, confidence: clamp01(item.confidence), evidenceIds: unique(item.evidenceIds) });
  }
  return changes;
}

function eventDiff(a: ListeningFrame, b: ListeningFrame): ListeningEventChange[] {
  const aSet = new Set(a.eventIds);
  const bSet = new Set(b.eventIds);
  return unique([...a.eventIds, ...b.eventIds]).map((eventId) => ({
    eventId,
    side: aSet.has(eventId) && bSet.has(eventId) ? "shared" : bSet.has(eventId) ? "added" : "removed",
    confidence: clamp01(Math.min(a.confidence, b.confidence)),
    evidenceIds: unique([...a.evidenceIds, ...b.evidenceIds]),
  }));
}

/**
 * Director A/B compares two already-derived listening states. It reports measurable
 * and perceptual deltas but deliberately does not decide which version is better
 * and never authorizes an edit.
 */
export function compareListeningFrames(original: ListeningFrame, candidate: ListeningFrame): ListeningABComparison {
  if (original.region.startSample !== candidate.region.startSample || original.region.endSample !== candidate.region.endSample) {
    throw new Error("Director A/B requires identical sample regions for aligned comparison.");
  }
  if (original.sourceArtifactId === candidate.sourceArtifactId && original.id === candidate.id) {
    throw new Error("Director A/B requires distinct listening states.");
  }

  const objectiveChanges = [
    compareNumeric("tempoBpm", original.rhythm.tempoBpm, candidate.rhythm.tempoBpm, "objective", Math.min(original.rhythm.beatConfidence, candidate.rhythm.beatConfidence), [...original.rhythm.evidenceIds, ...candidate.rhythm.evidenceIds]),
    compareNumeric("timingDeviation", original.rhythm.timingDeviation, candidate.rhythm.timingDeviation, "objective", Math.min(original.rhythm.beatConfidence, candidate.rhythm.beatConfidence), [...original.rhythm.evidenceIds, ...candidate.rhythm.evidenceIds]),
    compareNumeric("rms", original.dynamics.rms, candidate.dynamics.rms, "objective", Math.min(original.dynamics.confidence, candidate.dynamics.confidence), [...original.dynamics.evidenceIds, ...candidate.dynamics.evidenceIds]),
    compareNumeric("peak", original.dynamics.peak, candidate.dynamics.peak, "objective", Math.min(original.dynamics.confidence, candidate.dynamics.confidence), [...original.dynamics.evidenceIds, ...candidate.dynamics.evidenceIds]),
    compareNumeric("crestFactor", original.dynamics.crestFactor, candidate.dynamics.crestFactor, "objective", Math.min(original.dynamics.confidence, candidate.dynamics.confidence), [...original.dynamics.evidenceIds, ...candidate.dynamics.evidenceIds]),
    compareNumeric("spectralCentroid", original.timbre.spectralCentroid, candidate.timbre.spectralCentroid, "objective", Math.min(original.timbre.confidence, candidate.timbre.confidence), [...original.timbre.evidenceIds, ...candidate.timbre.evidenceIds]),
    compareNumeric("spectralFlatness", original.timbre.spectralFlatness, candidate.timbre.spectralFlatness, "objective", Math.min(original.timbre.confidence, candidate.timbre.confidence), [...original.timbre.evidenceIds, ...candidate.timbre.evidenceIds]),
    compareNumeric("channelBalance", original.spatial.channelBalance, candidate.spatial.channelBalance, "objective", Math.min(original.spatial.confidence, candidate.spatial.confidence), [...original.spatial.evidenceIds, ...candidate.spatial.evidenceIds]),
    compareNumeric("stereoWidth", original.spatial.stereoWidth, candidate.spatial.stereoWidth, "objective", Math.min(original.spatial.confidence, candidate.spatial.confidence), [...original.spatial.evidenceIds, ...candidate.spatial.evidenceIds]),
    compareNumeric("phaseRisk", original.spatial.phaseRisk, candidate.spatial.phaseRisk, "objective", Math.min(original.spatial.confidence, candidate.spatial.confidence), [...original.spatial.evidenceIds, ...candidate.spatial.evidenceIds]),
    compareNumeric("microtimingDeviation", original.performance.microtimingDeviation, candidate.performance.microtimingDeviation, "objective", Math.min(original.performance.confidence, candidate.performance.confidence), [...original.performance.evidenceIds, ...candidate.performance.evidenceIds]),
    compareNumeric("noiseLevel", original.recording.noiseLevel, candidate.recording.noiseLevel, "objective", Math.min(original.recording.confidence, candidate.recording.confidence), [...original.recording.evidenceIds, ...candidate.recording.evidenceIds]),
    compareNumeric("distortionLevel", original.recording.distortionLevel, candidate.recording.distortionLevel, "objective", Math.min(original.recording.confidence, candidate.recording.confidence), [...original.recording.evidenceIds, ...candidate.recording.evidenceIds]),
    compareNumeric("tapeCharacter", original.recording.tapeCharacter, candidate.recording.tapeCharacter, "objective", Math.min(original.recording.confidence, candidate.recording.confidence), [...original.recording.evidenceIds, ...candidate.recording.evidenceIds]),
    compareNumeric("roomLevel", original.recording.roomLevel, candidate.recording.roomLevel, "objective", Math.min(original.recording.confidence, candidate.recording.confidence), [...original.recording.evidenceIds, ...candidate.recording.evidenceIds]),
  ].filter((item): item is ListeningNumericChange => item !== undefined);

  const perceptualChanges = descriptorDiff(original.perceptualDescriptors, candidate.perceptualDescriptors, "perceptual");
  const intentChanges = descriptorDiff(original.musicalIntentHypotheses, candidate.musicalIntentHypotheses, "intent-hypothesis");
  const events = eventDiff(original, candidate);

  const damageEvidenceAdded = candidate.anomalies.damageEvidenceIds.filter((id) => !original.anomalies.damageEvidenceIds.includes(id));
  const damageEvidenceRemoved = original.anomalies.damageEvidenceIds.filter((id) => !candidate.anomalies.damageEvidenceIds.includes(id));
  const descriptorsAdded = candidate.anomalies.descriptors.filter((id) => !original.anomalies.descriptors.includes(id));
  const descriptorsRemoved = original.anomalies.descriptors.filter((id) => !candidate.anomalies.descriptors.includes(id));

  const improvements: string[] = [];
  const regressions: string[] = [];
  const unchanged: string[] = [];
  for (const change of objectiveChanges) {
    if (Math.abs(change.delta ?? 0) < 1e-9) unchanged.push(change.metric);
  }
  if (damageEvidenceRemoved.length > 0) improvements.push("damage evidence decreased in the candidate frame");
  if (damageEvidenceAdded.length > 0) regressions.push("new damage evidence appears in the candidate frame");
  if ((candidate.spatial.phaseRisk ?? 0) < (original.spatial.phaseRisk ?? 0)) improvements.push("phase risk decreased");
  if ((candidate.recording.distortionLevel ?? 0) < (original.recording.distortionLevel ?? 0)) improvements.push("distortion level decreased");
  if ((candidate.recording.noiseLevel ?? 0) < (original.recording.noiseLevel ?? 0)) improvements.push("noise level decreased");
  if ((candidate.spatial.phaseRisk ?? 0) > (original.spatial.phaseRisk ?? 0)) regressions.push("phase risk increased");
  if ((candidate.recording.distortionLevel ?? 0) > (original.recording.distortionLevel ?? 0)) regressions.push("distortion level increased");
  if ((candidate.recording.noiseLevel ?? 0) > (original.recording.noiseLevel ?? 0)) regressions.push("noise level increased");

  const evidenceIds = unique([...original.evidenceIds, ...candidate.evidenceIds, ...objectiveChanges.flatMap((x) => x.evidenceIds), ...perceptualChanges.flatMap((x) => x.evidenceIds), ...intentChanges.flatMap((x) => x.evidenceIds)]);
  const confidence = clamp01(Math.min(original.confidence, candidate.confidence) * (evidenceIds.length ? 1 : 0));
  const insufficient = confidence < 0.5 || !evidenceIds.length;
  const hasChange = objectiveChanges.some((x) => Math.abs(x.delta ?? 0) > 1e-9) || perceptualChanges.some((x) => x.side !== "shared") || intentChanges.some((x) => x.side !== "shared") || events.some((x) => x.side !== "shared") || damageEvidenceAdded.length > 0 || damageEvidenceRemoved.length > 0;

  return {
    id: `ab:${original.id}:${candidate.id}`,
    originalFrameId: original.id,
    candidateFrameId: candidate.id,
    sourceArtifactId: original.sourceArtifactId,
    candidateArtifactId: candidate.sourceArtifactId,
    region: original.region,
    status: insufficient ? "insufficient-evidence" : hasChange ? (regressions.length && !improvements.length ? "regressed" : improvements.length && !regressions.length ? "improved" : "changed") : "unchanged",
    objectiveChanges,
    perceptualChanges,
    intentChanges,
    eventChanges: events,
    anomalyChange: { damageEvidenceAdded, damageEvidenceRemoved, descriptorsAdded, descriptorsRemoved },
    improvements: unique(improvements),
    regressions: unique(regressions),
    unchanged: unique(unchanged),
    evidenceIds,
    confidence,
    abstained: insufficient,
    reasons: [
      "A/B comparison is evidence only and does not authorize restoration, replacement, mixing, or mastering.",
      ...(insufficient ? ["Comparison confidence or evidence coverage is insufficient for a reliable judgment."] : []),
      ...(intentChanges.some((x) => x.side !== "shared") ? ["Musical-intent differences are hypotheses, not established facts."] : []),
    ],
  };
}

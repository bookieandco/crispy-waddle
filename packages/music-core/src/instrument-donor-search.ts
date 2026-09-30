import type { InstrumentFamily } from "./instrument-replacement.js";

export type InstrumentDonorFamily = Extract<InstrumentFamily, "drums" | "percussion" | "bass">;

export type InstrumentDonorEventKind =
  | "kick"
  | "snare"
  | "hat"
  | "cymbal"
  | "tom"
  | "percussion"
  | "bass-event"
  | "unknown";

export interface InstrumentDonorTargetRegion {
  startMs: number;
  endMs: number;
}

export interface InstrumentDonorSearchInput {
  sourceArtifactId: string;
  instrumentFamily: InstrumentDonorFamily;
  eventKind?: InstrumentDonorEventKind;
  target: InstrumentDonorTargetRegion;
  maxCandidates?: number;
}

export interface InstrumentDonorCandidate {
  candidateId: string;
  artifactId: string;
  sourceArtifactId: string;
  sourceStartMs: number;
  sourceEndMs: number;
  similarityScore: number;
  qualityScore: number;
  contextScore: number;
  searchScore: number;
  damageScore: number;
  expectedGain: number;
  runtimeReceiptId: string;
}

const EVENT_KINDS = new Set<InstrumentDonorEventKind>([
  "kick","snare","hat","cymbal","tom","percussion","bass-event","unknown",
]);

export function validateInstrumentDonorSearchInput(input: InstrumentDonorSearchInput): void {
  if (!input.sourceArtifactId.trim()) throw new Error("donor search source artifact is required");
  if (!["drums","percussion","bass"].includes(input.instrumentFamily)) {
    throw new Error("donor search supports drums, percussion, and bass only");
  }
  if (input.eventKind && !EVENT_KINDS.has(input.eventKind)) {
    throw new Error("donor search event kind is invalid");
  }
  if (!Number.isFinite(input.target.startMs) || input.target.startMs < 0 ||
      !Number.isFinite(input.target.endMs) || input.target.endMs <= input.target.startMs) {
    throw new Error("donor search target region is invalid");
  }
  const duration = input.target.endMs - input.target.startMs;
  if (duration < 20 || duration > 5000) {
    throw new Error("donor search target duration must remain between 20 ms and 5 s");
  }
  const maxCandidates = input.maxCandidates ?? 3;
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 5) {
    throw new Error("donor search maxCandidates must remain between 1 and 5");
  }
}

export function instrumentDonorSourceRoleAllowed(
  role: string | undefined,
  family: InstrumentDonorFamily,
): boolean {
  const normalized = role?.trim().toLowerCase() ?? "";
  if (family === "bass") {
    return normalized === "bass" || normalized === "reconstructed-bass";
  }
  return normalized === "drums" || normalized === "reconstructed-drums";
}

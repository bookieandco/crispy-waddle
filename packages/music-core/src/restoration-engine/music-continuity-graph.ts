export type MusicCorrespondenceKind =
  | "same-recording"
  | "same-performance"
  | "same-song"
  | "same-section"
  | "same-take"
  | "alternate-transfer"
  | "alternate-mix"
  | "different-performance"
  | "unknown";

export type MusicEvidenceSource = "olaf" | "crepe" | "audioflux" | "omnizart" | "miditok";

export interface MusicCorrespondenceObservation {
  source: MusicEvidenceSource;
  evidenceId: string;
  score: number;
  confidence: number;
  attributes?: Record<string, unknown>;
}

export interface MusicContinuityNode {
  id: string;
  caseId: string;
  artifactId: string;
  versionId?: string;
  region?: { startSample: number; endSample: number };
}

export interface MusicContinuityEdge {
  from: string;
  to: string;
  kind: MusicCorrespondenceKind;
  confidence: number;
  observations: MusicCorrespondenceObservation[];
  alignment?: { offsetSamples: number; driftPpm?: number };
  provenance: string[];
}

const finite01 = (value: number, label: string): number => {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  if (value < 0 || value > 1) throw new Error(`${label} must be between 0 and 1`);
  return value;
};

export function createContinuityNode(node: MusicContinuityNode): MusicContinuityNode {
  if (!node.id || !node.caseId || !node.artifactId) throw new Error("Continuity node identity is required");
  if (node.region && (!Number.isInteger(node.region.startSample) || !Number.isInteger(node.region.endSample) || node.region.endSample <= node.region.startSample)) {
    throw new Error("Continuity node region is invalid");
  }
  return { ...node };
}

/** Combines independent observations conservatively; it never asserts historical authenticity. */
export function buildCorrespondenceEdge(
  from: MusicContinuityNode,
  to: MusicContinuityNode,
  kind: MusicCorrespondenceKind,
  observations: MusicCorrespondenceObservation[],
  alignment?: { offsetSamples: number; driftPpm?: number },
): MusicContinuityEdge {
  createContinuityNode(from);
  createContinuityNode(to);
  if (from.id === to.id) throw new Error("Continuity edge cannot connect a node to itself");
  if (observations.length === 0) throw new Error("At least one correspondence observation is required");

  const normalized = observations.map((observation) => ({
    ...observation,
    score: finite01(observation.score, "Correspondence score"),
    confidence: finite01(observation.confidence, "Correspondence confidence"),
  }));
  const weighted = normalized.reduce((sum, item) => sum + item.score * item.confidence, 0);
  const weight = normalized.reduce((sum, item) => sum + item.confidence, 0);
  const confidence = weight === 0 ? 0 : Math.min(1, weighted / weight);

  if (alignment && (!Number.isInteger(alignment.offsetSamples) || (alignment.driftPpm !== undefined && !Number.isFinite(alignment.driftPpm)))) {
    throw new Error("Continuity alignment is invalid");
  }

  return {
    from: from.id,
    to: to.id,
    kind,
    confidence,
    observations: normalized,
    alignment,
    provenance: [...new Set(normalized.map((item) => item.evidenceId))],
  };
}

/** Only correspondence edges meeting a caller-supplied evidence threshold become recovery candidates. */
export function selectRecoveryCorrespondence(edges: MusicContinuityEdge[], minConfidence = 0.8): MusicContinuityEdge[] {
  finite01(minConfidence, "Minimum correspondence confidence");
  return edges
    .filter((edge) => edge.confidence >= minConfidence)
    .filter((edge) => edge.kind !== "different-performance" && edge.kind !== "unknown")
    .map((edge) => ({ ...edge, observations: [...edge.observations], provenance: [...edge.provenance] }));
}

import type { DeepStemDecomposition, DeepStemNode } from "./deep-stem-decomposition.js";

export type VocalLayerKind =
  | "lead"
  | "backing"
  | "double"
  | "harmony"
  | "ad-lib"
  | "spoken"
  | "shout"
  | "response"
  | "effect"
  | "breath"
  | "unknown";

export interface VocalLayerObservation {
  id: string;
  sourceArtifactId: string;
  parentNodeId: string;
  kind: VocalLayerKind;
  label: string;
  region: { startSample: number; endSample: number };
  confidence: number;
  evidenceIds: string[];
  provenanceIds: string[];
  canonicalSource: boolean;
}

export interface VocalLayerDecomposition {
  id: string;
  sourceArtifactId: string;
  observations: VocalLayerObservation[];
  adLibIds: string[];
  confidence: number;
  abstained: boolean;
  reasons: string[];
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const unique = (values: string[]) => [...new Set(values)];

const labels: Record<string, VocalLayerKind> = {
  lead: "lead",
  backing: "backing",
  background: "backing",
  double: "double",
  harmony: "harmony",
  "ad-lib": "ad-lib",
  adlib: "ad-lib",
  "ad lib": "ad-lib",
  spoken: "spoken",
  shout: "shout",
  response: "response",
  effect: "effect",
  fx: "effect",
  breath: "breath",
};

function classify(label: string): VocalLayerKind {
  return labels[label.trim().toLowerCase()] ?? "unknown";
}

/**
 * Maps recursive vocal separation nodes into explicit vocal-layer evidence.
 * Ad-libs are independent musical events and must not be folded into lead-vocal identity.
 */
export function buildVocalLayerDecomposition(input: {
  id: string;
  sourceArtifactId: string;
  decomposition: DeepStemDecomposition;
}): VocalLayerDecomposition {
  const reasons: string[] = [];
  const observations = decomposition.nodes
    .filter((node) => node.sourceArtifactId === input.sourceArtifactId)
    .filter((node) => node.kind === "stem" || node.kind === "sub-stem" || node.kind === "event" || node.kind === "event-component")
    .filter((node) => node.label.toLowerCase().includes("vocal") || node.label.toLowerCase().includes("voice") || node.label.toLowerCase().includes("ad-lib") || node.label.toLowerCase().includes("adlib") || ["lead", "backing", "double", "harmony", "spoken", "shout", "response", "breath"].includes(node.label.toLowerCase()))
    .map((node: DeepStemNode): VocalLayerObservation => ({
      id: `vocal-layer:${node.id}`,
      sourceArtifactId: input.sourceArtifactId,
      parentNodeId: node.id,
      kind: classify(node.label),
      label: node.label,
      region: node.region,
      confidence: clamp01(node.confidence),
      evidenceIds: unique(node.evidenceIds),
      provenanceIds: unique(node.provenanceIds),
      canonicalSource: false,
    }));

  const adLibIds = observations.filter((observation) => observation.kind === "ad-lib").map((observation) => observation.id);
  if (decomposition.abstained) reasons.push("Parent deep-stem decomposition is abstained.");
  if (!observations.length) reasons.push("No vocal-layer observations were established.");
  if (adLibIds.length === 0) reasons.push("No ad-lib layer was established; absence is not evidence that ad-libs are absent from the recording.");

  const confidence = observations.length
    ? observations.reduce((sum, observation) => sum + observation.confidence, 0) / observations.length
    : 0;

  return {
    id: input.id,
    sourceArtifactId: input.sourceArtifactId,
    observations,
    adLibIds,
    confidence: clamp01(confidence),
    abstained: decomposition.abstained || observations.length === 0,
    reasons: unique(reasons),
  };
}

export function adLibObservations(decomposition: VocalLayerDecomposition): VocalLayerObservation[] {
  return decomposition.observations.filter((observation) => observation.kind === "ad-lib");
}

export function canUseVocalLayerForRestoration(observation: VocalLayerObservation): boolean {
  return observation.confidence >= 0.6 && observation.evidenceIds.length > 0 && observation.provenanceIds.length > 0 && !observation.canonicalSource;
}

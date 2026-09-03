export type DeepStemKind =
  | "mix"
  | "stem"
  | "sub-stem"
  | "event"
  | "event-component"
  | "unknown";

export type DeepStemSourceKind =
  | "source-mix"
  | "separated-stem"
  | "recursive-separation"
  | "event-decomposition";

export interface DeepStemRegion {
  startSample: number;
  endSample: number;
}

export interface DeepStemNode {
  id: string;
  sourceArtifactId: string;
  parentId?: string;
  kind: DeepStemKind;
  label: string;
  region: DeepStemRegion;
  sampleRate: number;
  modelId: string;
  modelVersion: string;
  sourceKind: DeepStemSourceKind;
  confidence: number;
  bleedEstimate?: number;
  residualEnergy?: number;
  evidenceIds: string[];
  provenanceIds: string[];
  canonicalSource: boolean;
}

export interface DeepStemDecomposition {
  id: string;
  sourceArtifactId: string;
  rootId: string;
  nodes: DeepStemNode[];
  maxDepth: number;
  confidence: number;
  evidenceIds: string[];
  abstained: boolean;
  reasons: string[];
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const unique = (values: string[]): string[] => [...new Set(values)];

const validRegion = (region: DeepStemRegion): boolean =>
  Number.isInteger(region.startSample) &&
  Number.isInteger(region.endSample) &&
  region.startSample >= 0 &&
  region.endSample > region.startSample;

/**
 * Normalizes recursive separation output into evidence-bearing nodes.
 * Separation output is never promoted to canonical source truth.
 */
export function buildDeepStemDecomposition(input: {
  id: string;
  sourceArtifactId: string;
  rootId: string;
  nodes: DeepStemNode[];
}): DeepStemDecomposition {
  const reasons: string[] = [];
  const nodes = input.nodes
    .filter((node) => node.sourceArtifactId === input.sourceArtifactId)
    .filter((node) => validRegion(node.region))
    .map((node) => ({
      ...node,
      confidence: clamp01(node.confidence),
      bleedEstimate: node.bleedEstimate === undefined ? undefined : clamp01(node.bleedEstimate),
      residualEnergy: node.residualEnergy === undefined ? undefined : clamp01(node.residualEnergy),
      evidenceIds: unique(node.evidenceIds),
      provenanceIds: unique(node.provenanceIds),
      canonicalSource: node.canonicalSource && node.kind === "mix" && node.sourceKind === "source-mix",
    }));

  const root = nodes.find((node) => node.id === input.rootId);
  if (!root) reasons.push("Root node is missing or invalid.");

  const nodeIds = new Set(nodes.map((node) => node.id));
  for (const node of nodes) {
    if (node.parentId && !nodeIds.has(node.parentId)) {
      reasons.push(`Missing parent for node ${node.id}.`);
    }
    if (node.parentId === node.id) {
      reasons.push(`Node ${node.id} cannot parent itself.`);
    }
    if (node.kind !== "mix" && node.canonicalSource) {
      reasons.push(`Non-mix node ${node.id} cannot be canonical source truth.`);
    }
  }

  const depthOf = (node: DeepStemNode, seen = new Set<string>()): number => {
    if (!node.parentId) return 0;
    if (seen.has(node.id)) return 0;
    const parent = nodes.find((candidate) => candidate.id === node.parentId);
    if (!parent) return 0;
    seen.add(node.id);
    return 1 + depthOf(parent, seen);
  };

  const maxDepth = nodes.reduce((max, node) => Math.max(max, depthOf(node)), 0);
  const evidenceIds = unique(nodes.flatMap((node) => node.evidenceIds));
  const confidence = nodes.length === 0
    ? 0
    : nodes.reduce((sum, node) => sum + node.confidence, 0) / nodes.length;

  const abstained = !root || reasons.length > 0 || nodes.length === 0;
  if (nodes.length === 0) reasons.push("No valid deep-stem observations remain.");

  return {
    id: input.id,
    sourceArtifactId: input.sourceArtifactId,
    rootId: input.rootId,
    nodes,
    maxDepth,
    confidence,
    evidenceIds,
    abstained,
    reasons: unique(reasons),
  };
}

export function descendantsOf(
  decomposition: DeepStemDecomposition,
  parentId: string,
): DeepStemNode[] {
  return decomposition.nodes.filter((node) => node.parentId === parentId);
}

export function leafNodes(decomposition: DeepStemDecomposition): DeepStemNode[] {
  const parentIds = new Set(
    decomposition.nodes
      .map((node) => node.parentId)
      .filter((id): id is string => Boolean(id)),
  );
  return decomposition.nodes.filter((node) => !parentIds.has(node.id));
}

/**
 * Deep decomposition can inform analysis/reconstruction, but never authorizes a change.
 */
export function canUseForRestorationEvidence(node: DeepStemNode): boolean {
  return node.confidence >= 0.6 &&
    node.evidenceIds.length > 0 &&
    node.provenanceIds.length > 0 &&
    !node.canonicalSource;
}

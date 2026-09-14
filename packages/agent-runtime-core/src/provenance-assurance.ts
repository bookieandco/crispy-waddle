import { createHash } from 'node:crypto';

export type ProvenanceStatus =
  | 'SOURCE_VERIFIED' | 'BUILD_VERIFIED' | 'ARTIFACT_VERIFIED'
  | 'DEPLOYMENT_VERIFIED' | 'RUNTIME_VERIFIED' | 'EFFECT_VERIFIED'
  | 'PARTIAL' | 'CONTRADICTED' | 'UNKNOWN';
export type ProvenanceNodeType = 'source' | 'commit' | 'manifest' | 'contract' | 'compiler' | 'dependency' | 'build' | 'artifact' | 'sbom' | 'signature' | 'attestation' | 'test' | 'canary' | 'promotion' | 'deployment' | 'workload' | 'runtime' | 'effect' | 'provider_receipt';
export type ProvenanceEdgeType = 'DERIVED_FROM' | 'COMPILED_FROM' | 'GENERATED_FROM' | 'DEPENDS_ON' | 'BUILT_BY' | 'SIGNED_BY' | 'ATTESTED_BY' | 'TESTED_BY' | 'CANARIED_BY' | 'PROMOTED_BY' | 'DEPLOYED_AS' | 'LOADED_BY' | 'EXECUTED_BY' | 'CAUSED' | 'PRODUCED' | 'VERIFIED_BY' | 'RECONCILED_BY';
export type ProvenanceNode = { id: string; type: ProvenanceNodeType; hash: string; metadata?: Readonly<Record<string, unknown>> };
export type ProvenanceEdge = { from: string; to: string; type: ProvenanceEdgeType; evidenceRefs?: readonly string[] };
export type ArtifactIdentity = { artifactId: string; artifactType: string; artifactHash: string; sourceHash?: string; contractHash?: string; semanticHash?: string; dependencyLockHash?: string; compilerHash?: string; buildPlanHash?: string; environmentHash?: string; configurationHash?: string; provenanceHash: string; identityHash: string };
export type BuildProvenance = { buildId: string; sourceRefs: readonly string[]; sourceCommit?: string; manifestHash?: string; contractLockHash?: string; semanticGraphHash?: string; dependencyGraphHash?: string; compilerIdentity?: string; buildEnvironment?: string; builderIdentity?: string; builderAttestation?: string; inputArtifacts: readonly string[]; outputArtifacts: readonly string[]; testResults: readonly string[]; securityResults: readonly string[]; buildLogHash?: string; controlEpoch?: number; provenanceHash: string };
export type ProvenanceSnapshot = { nodes: readonly ProvenanceNode[]; edges: readonly ProvenanceEdge[]; controlEpoch?: number; graphHash: string };
export type ProvenanceDrift = { resourceId: string; expectedHash?: string; observedHash?: string; status: 'MATCH' | 'DRIFT' | 'UNKNOWN'; affectedNodeIds: readonly string[] };
export type ProvenanceGraphValidation = { valid: boolean; errors: readonly string[]; warnings: readonly string[] };
export type ProvenanceQuery = { snapshot: ProvenanceSnapshot; traceBackward(id: string): ProvenanceNode[]; traceForward(id: string): ProvenanceNode[]; findCauses(id: string): ProvenanceNode[]; findDependents(id: string): ProvenanceNode[] };

export function canonicalize(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(',')}}`;
}
export function sha256(value: unknown): string { return createHash('sha256').update(canonicalize(value)).digest('hex'); }
export function createArtifactIdentity(input: Omit<ArtifactIdentity, 'provenanceHash' | 'identityHash'>): ArtifactIdentity {
  const provenanceHash = sha256({ sourceHash: input.sourceHash, contractHash: input.contractHash, semanticHash: input.semanticHash, dependencyLockHash: input.dependencyLockHash, compilerHash: input.compilerHash, buildPlanHash: input.buildPlanHash, environmentHash: input.environmentHash, configurationHash: input.configurationHash });
  return { ...input, provenanceHash, identityHash: sha256({ ...input, provenanceHash }) };
}
export function createBuildProvenance(input: Omit<BuildProvenance, 'provenanceHash'>): BuildProvenance { return { ...input, provenanceHash: sha256(input) }; }
export function createProvenanceSnapshot(nodes: readonly ProvenanceNode[], edges: readonly ProvenanceEdge[], controlEpoch?: number): ProvenanceSnapshot {
  const sortedNodes = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  const sortedEdges = [...edges].sort((a, b) => `${a.from}:${a.to}:${a.type}`.localeCompare(`${b.from}:${b.to}:${b.type}`));
  return { nodes: sortedNodes, edges: sortedEdges, controlEpoch, graphHash: sha256({ nodes: sortedNodes, edges: sortedEdges, controlEpoch }) };
}
export function validateProvenanceGraph(snapshot: ProvenanceSnapshot): ProvenanceGraphValidation {
  const errors: string[] = []; const warnings: string[] = []; const ids = new Set<string>();
  for (const node of snapshot.nodes) { if (ids.has(node.id)) errors.push(`DUPLICATE_NODE:${node.id}`); ids.add(node.id); if (!node.hash) errors.push(`MISSING_NODE_HASH:${node.id}`); }
  for (const edge of snapshot.edges) { if (!ids.has(edge.from)) errors.push(`MISSING_EDGE_SOURCE:${edge.from}`); if (!ids.has(edge.to)) errors.push(`MISSING_EDGE_TARGET:${edge.to}`); if (edge.from === edge.to) warnings.push(`SELF_EDGE:${edge.from}`); }
  if (snapshot.graphHash !== sha256({ nodes: snapshot.nodes, edges: snapshot.edges, controlEpoch: snapshot.controlEpoch })) errors.push('GRAPH_HASH_MISMATCH');
  return { valid: errors.length === 0, errors, warnings };
}
export function traceProvenance(snapshot: ProvenanceSnapshot, start: string, direction: 'backward' | 'forward'): ProvenanceNode[] {
  const adjacency = new Map<string, string[]>();
  for (const edge of snapshot.edges) { const from = direction === 'forward' ? edge.from : edge.to; const to = direction === 'forward' ? edge.to : edge.from; adjacency.set(from, [...(adjacency.get(from) ?? []), to]); }
  const seen = new Set<string>(); const order: string[] = []; const queue = [start];
  while (queue.length) { const current = queue.shift()!; for (const next of adjacency.get(current) ?? []) if (!seen.has(next)) { seen.add(next); order.push(next); queue.push(next); } }
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  return order.flatMap((id) => { const node = nodesById.get(id); return node ? [node] : []; });
}
export function createProvenanceQuery(snapshot: ProvenanceSnapshot): ProvenanceQuery { const traceBackward = (id: string) => traceProvenance(snapshot, id, 'backward'); const traceForward = (id: string) => traceProvenance(snapshot, id, 'forward'); return { snapshot, traceBackward, traceForward, findCauses: traceBackward, findDependents: traceForward }; }
export function detectProvenanceDrift(resourceId: string, expectedHash: string | undefined, observedHash: string | undefined, snapshot: ProvenanceSnapshot): ProvenanceDrift {
  if (!expectedHash || !observedHash) return { resourceId, expectedHash, observedHash, status: 'UNKNOWN', affectedNodeIds: [] };
  if (expectedHash === observedHash) return { resourceId, expectedHash, observedHash, status: 'MATCH', affectedNodeIds: [] };
  return { resourceId, expectedHash, observedHash, status: 'DRIFT', affectedNodeIds: traceProvenance(snapshot, resourceId, 'forward').map((node) => node.id) };
}
export function validateProductionArtifact(identity: ArtifactIdentity): ProvenanceStatus {
  if (!identity.artifactHash || !identity.provenanceHash || !identity.identityHash) return 'UNKNOWN';
  const expected = createArtifactIdentity({ artifactId: identity.artifactId, artifactType: identity.artifactType, artifactHash: identity.artifactHash, sourceHash: identity.sourceHash, contractHash: identity.contractHash, semanticHash: identity.semanticHash, dependencyLockHash: identity.dependencyLockHash, compilerHash: identity.compilerHash, buildPlanHash: identity.buildPlanHash, environmentHash: identity.environmentHash, configurationHash: identity.configurationHash });
  return expected.identityHash === identity.identityHash && expected.provenanceHash === identity.provenanceHash ? 'ARTIFACT_VERIFIED' : 'CONTRADICTED';
}

import type { DurableKnowledgeGraphStore, KnowledgeGraph, KnowledgeNode, KnowledgeRelation } from '@jhadina/knowledge-graph'
import type { SpatialGraphContribution } from './integration.js'

function toKnowledgeNode(node: SpatialGraphContribution['nodes'][number], evidenceRefs: string[]): KnowledgeNode {
  const label = typeof node.attributes.name === 'string' && node.attributes.name.trim() ? node.attributes.name : node.ref
  return {
    nodeId: node.ref,
    nodeType: node.type,
    label,
    attributes: { ...node.attributes, spatial: true },
    provenanceRefs: [...new Set(evidenceRefs)].sort(),
    validFrom: null,
    validTo: null,
  }
}

function toKnowledgeRelation(edge: SpatialGraphContribution['edges'][number]): KnowledgeRelation {
  return {
    relationId: edge.edgeId,
    fromNodeId: edge.fromRef,
    toNodeId: edge.toRef,
    relationType: edge.relation,
    attributes: { spatial: true },
    provenanceRefs: [...new Set(edge.evidenceRefs)].sort(),
    validFrom: edge.validFrom,
    validTo: edge.validTo,
  }
}

/** Project spatial relationships into the canonical in-memory KnowledgeGraph contract. */
export function projectSpatialContributionToKnowledgeGraph(graph: KnowledgeGraph, contribution: SpatialGraphContribution): void {
  for (const node of contribution.nodes) graph.registerNode(toKnowledgeNode(node, contribution.evidenceRefs))
  for (const edge of contribution.edges) graph.registerRelation(toKnowledgeRelation(edge))
}

/** Persist the same projection through the canonical durable KnowledgeGraph store. */
export async function persistSpatialContributionToKnowledgeGraph(store: DurableKnowledgeGraphStore, contribution: SpatialGraphContribution): Promise<{ nodes: number; relations: number }> {
  let nodes = 0
  let relations = 0
  for (const node of contribution.nodes) {
    if (await store.appendNode(toKnowledgeNode(node, contribution.evidenceRefs)) === 'APPENDED') nodes += 1
  }
  for (const edge of contribution.edges) {
    if (await store.appendRelation(toKnowledgeRelation(edge)) === 'APPENDED') relations += 1
  }
  return { nodes, relations }
}

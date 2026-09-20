import type { DurableKnowledgeGraphStore, KnowledgeGraph, KnowledgeNode, KnowledgeRelation } from '@jhadina/knowledge-graph'
import type { SpatialGraphContribution } from './integration.js'
import type { SpatialObservation } from './observation.js'

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


export interface SpatialKnowledgeSink {
  persist(contribution: SpatialGraphContribution): Promise<{ nodes: number; relations: number }>
}

/**
 * Turn one source observation into canonical KG identity/provenance links.
 * Dynamic telemetry remains evidence; graph nodes keep stable identity metadata
 * so a later observation cannot mutate an entity node in place.
 */
export function spatialObservationToGraphContribution(
  observation: SpatialObservation,
  evidenceRef: string,
): SpatialGraphContribution {
  if (!evidenceRef) throw new Error('SPATIAL_KNOWLEDGE_EVIDENCE_REQUIRED')
  const sourceRef = `spatial-source:${observation.provenance.source_ref}`
  const entityRef = `spatial-entity:${observation.entity.type}:${observation.entity.id}`
  return normalizeGraph({
    nodes: [
      {
        ref: sourceRef,
        type: 'spatial_source',
        attributes: {
          sourceId: observation.provenance.source_ref,
          provider: observation.source.provider,
          adapterVersion: observation.provenance.adapter_version,
        },
      },
      {
        ref: entityRef,
        type: observation.entity.type,
        attributes: {
          entityId: observation.entity.id,
          entityType: observation.entity.type,
        },
      },
    ],
    edges: [
      {
        edgeId: `spatial-observation:${observation.observation_id}`,
        fromRef: sourceRef,
        toRef: entityRef,
        relation: 'observed',
        evidenceRefs: [evidenceRef],
        validFrom: observation.observed_at,
        validTo: null,
      },
    ],
    evidenceRefs: [evidenceRef],
    limitations: [],
  })
}

function normalizeGraph(input: SpatialGraphContribution): SpatialGraphContribution {
  return {
    nodes: [...input.nodes].sort((a, b) => a.ref.localeCompare(b.ref)).map((node) => ({ ...node, attributes: { ...node.attributes } })),
    edges: [...input.edges].sort((a, b) => a.edgeId.localeCompare(b.edgeId)).map((edge) => ({ ...edge, evidenceRefs: [...new Set(edge.evidenceRefs)].sort() })),
    evidenceRefs: [...new Set(input.evidenceRefs)].sort(),
    limitations: [...input.limitations],
  }
}

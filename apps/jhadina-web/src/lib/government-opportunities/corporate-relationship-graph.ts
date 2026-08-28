export type CorporateRelationshipType =
  | "parent"
  | "subsidiary"
  | "successor"
  | "predecessor"
  | "affiliate";

export interface CorporateRelationshipEdge {
  fromEntityId: string;
  toEntityId: string;
  relationshipType: CorporateRelationshipType;
  confidence: number;
  source: string;
  sourceReference: string;
  evidenceIds: string[];
  observedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CorporateRelationshipGraph {
  entityId: string;
  edges: CorporateRelationshipEdge[];
}

export function normalizeCorporateRelationship(
  edge: CorporateRelationshipEdge,
): CorporateRelationshipEdge {
  return {
    ...edge,
    confidence: Math.max(0, Math.min(1, edge.confidence)),
    evidenceIds: [...new Set(edge.evidenceIds)].sort(),
  };
}

export function dedupeCorporateRelationships(
  edges: CorporateRelationshipEdge[],
): CorporateRelationshipEdge[] {
  const byKey = new Map<string, CorporateRelationshipEdge>();

  for (const edge of edges.map(normalizeCorporateRelationship)) {
    const key = [
      edge.fromEntityId,
      edge.toEntityId,
      edge.relationshipType,
      edge.source,
      edge.sourceReference,
    ].join("|");

    const existing = byKey.get(key);
    if (!existing || edge.confidence > existing.confidence) {
      byKey.set(key, edge);
    }
  }

  return [...byKey.values()];
}

export function buildCorporateRelationshipGraph(
  entityId: string,
  edges: CorporateRelationshipEdge[],
): CorporateRelationshipGraph {
  return {
    entityId,
    edges: dedupeCorporateRelationships(
      edges.filter((edge) => edge.fromEntityId === entityId || edge.toEntityId === entityId),
    ),
  };
}

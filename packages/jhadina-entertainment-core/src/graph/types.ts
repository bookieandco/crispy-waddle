export type CreativeNodeType =
  | "artist"
  | "song"
  | "movie"
  | "scene"
  | "creator"
  | "technique"
  | "genre"
  | "visual_style"
  | "work"
  | "preference";

export interface CreativeNode {
  id: string;
  type: CreativeNodeType;
  label: string;
  metadata?: Record<string, unknown>;
  provenance?: string[];
}

export type CreativeRelationType =
  | "created_by"
  | "contains"
  | "uses"
  | "similar_to"
  | "influenced_by"
  | "supports"
  | "conflicts_with"
  | "liked_by_user"
  | "disliked_by_user";

export interface CreativeRelation {
  id: string;
  from: string;
  to: string;
  type: CreativeRelationType;
  weight?: number;
  evidenceIds: string[];
}

export interface CreativeGraphQuery {
  nodeId?: string;
  nodeType?: CreativeNodeType;
  relationType?: CreativeRelationType;
  limit?: number;
}

export interface CreativeGraphRepository {
  addNode(node: CreativeNode): Promise<void>;
  addRelation(relation: CreativeRelation): Promise<void>;
  getNode(id: string): Promise<CreativeNode | undefined>;
  query(query: CreativeGraphQuery): Promise<CreativeNode[]>;
  getRelations(nodeId: string): Promise<CreativeRelation[]>;
}

export class InMemoryCreativeGraphRepository implements CreativeGraphRepository {
  private readonly nodes = new Map<string, CreativeNode>();
  private readonly relations = new Map<string, CreativeRelation>();

  async addNode(node: CreativeNode): Promise<void> {
    this.nodes.set(node.id, node);
  }

  async addRelation(relation: CreativeRelation): Promise<void> {
    this.relations.set(relation.id, relation);
  }

  async getNode(id: string): Promise<CreativeNode | undefined> {
    return this.nodes.get(id);
  }

  async query(query: CreativeGraphQuery): Promise<CreativeNode[]> {
    const relatedIds = query.relationType
      ? new Set(
          [...this.relations.values()]
            .filter((relation) => relation.type === query.relationType)
            .flatMap((relation) => [relation.from, relation.to]),
        )
      : undefined;

    return [...this.nodes.values()]
      .filter((node) => !query.nodeId || node.id === query.nodeId)
      .filter((node) => !query.nodeType || node.type === query.nodeType)
      .filter((node) => !relatedIds || relatedIds.has(node.id))
      .slice(0, query.limit ?? 100);
  }

  async getRelations(nodeId: string): Promise<CreativeRelation[]> {
    return [...this.relations.values()].filter(
      (relation) => relation.from === nodeId || relation.to === nodeId,
    );
  }
}

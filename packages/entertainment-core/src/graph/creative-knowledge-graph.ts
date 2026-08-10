import type {
  CreativeGraphRepository,
  CreativeNode,
  CreativeRelation,
  CreativeRelationType,
} from "../domain/creative-graph.js";

export class CreativeKnowledgeGraph {
  constructor(private readonly repository: CreativeGraphRepository) {}

  async registerNode(node: CreativeNode): Promise<void> {
    await this.repository.addNode(node);
  }

  async connect(
    from: CreativeNode,
    to: CreativeNode,
    type: CreativeRelationType,
    evidenceIds: string[] = [],
    weight = 1,
  ): Promise<void> {
    await this.repository.addRelation({
      id: `${from.id}:${type}:${to.id}`,
      from: from.id,
      to: to.id,
      type,
      evidenceIds,
      weight,
    });
  }

  async neighbors(nodeId: string): Promise<CreativeNode[]> {
    const relations = await this.repository.getRelations(nodeId);
    const ids = new Set(
      relations.map((relation) =>
        relation.from === nodeId ? relation.to : relation.from,
      ),
    );

    const nodes = await Promise.all(
      [...ids].map((id) => this.repository.getNode(id)),
    );

    return nodes.filter((node): node is CreativeNode => Boolean(node));
  }

  async explain(nodeId: string): Promise<CreativeRelation[]> {
    return this.repository.getRelations(nodeId);
  }
}

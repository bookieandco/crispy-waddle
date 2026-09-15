export type KnowledgeNode = {
  nodeId: string
  nodeType: string
  label: string
  attributes?: Record<string, unknown>
  provenanceRefs?: string[]
  validFrom?: string | null
  validTo?: string | null
}

export type KnowledgeRelation = {
  relationId: string
  fromNodeId: string
  toNodeId: string
  relationType: string
  attributes?: Record<string, unknown>
  provenanceRefs?: string[]
  validFrom?: string | null
  validTo?: string | null
}

export interface KnowledgeGraph {
  registerNode(node: KnowledgeNode): void
  registerRelation(relation: KnowledgeRelation): void
  getNode(nodeId: string): KnowledgeNode | undefined
  getRelations(nodeId: string): KnowledgeRelation[]
}

export class InMemoryKnowledgeGraph implements KnowledgeGraph {
  private readonly nodes = new Map<string, KnowledgeNode>()
  private readonly relations = new Map<string, KnowledgeRelation>()

  registerNode(node: KnowledgeNode): void {
    if (!node.nodeId || !node.nodeType || !node.label) throw new Error('KNOWLEDGE_NODE_INVALID')
    const existing = this.nodes.get(node.nodeId)
    if (existing && JSON.stringify(existing) !== JSON.stringify(node)) throw new Error('KNOWLEDGE_NODE_ID_CONFLICT')
    this.nodes.set(node.nodeId, { ...node, provenanceRefs: [...(node.provenanceRefs ?? [])] })
  }

  registerRelation(relation: KnowledgeRelation): void {
    if (!relation.relationId || !relation.fromNodeId || !relation.toNodeId || !relation.relationType) throw new Error('KNOWLEDGE_RELATION_INVALID')
    if (!this.nodes.has(relation.fromNodeId) || !this.nodes.has(relation.toNodeId)) throw new Error('KNOWLEDGE_RELATION_NODE_MISSING')
    const existing = this.relations.get(relation.relationId)
    if (existing && JSON.stringify(existing) !== JSON.stringify(relation)) throw new Error('KNOWLEDGE_RELATION_ID_CONFLICT')
    this.relations.set(relation.relationId, { ...relation, provenanceRefs: [...(relation.provenanceRefs ?? [])] })
  }

  getNode(nodeId: string): KnowledgeNode | undefined {
    const node = this.nodes.get(nodeId)
    return node ? { ...node, provenanceRefs: [...(node.provenanceRefs ?? [])] } : undefined
  }

  getRelations(nodeId: string): KnowledgeRelation[] {
    return [...this.relations.values()]
      .filter((relation) => relation.fromNodeId === nodeId || relation.toNodeId === nodeId)
      .map((relation) => ({ ...relation, provenanceRefs: [...(relation.provenanceRefs ?? [])] }))
      .sort((a, b) => a.relationId.localeCompare(b.relationId))
  }
}

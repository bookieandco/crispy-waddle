export type SharkKnowledgeNode = {
  nodeId: string
  nodeType: 'EXPERIENCE' | 'PATTERN' | 'HYPOTHESIS'
  label: string
}

export type SharkKnowledgeRelation = {
  relationId: string
  fromNodeId: string
  toNodeId: string
  relationType: 'SUPPORTS' | 'CONTRADICTS' | 'SIMILAR_TO' | 'DERIVED_FROM'
  weight: number
}

export function addSharkKnowledgeRelation(
  nodes: SharkKnowledgeNode[],
  relations: SharkKnowledgeRelation[],
  relation: SharkKnowledgeRelation,
): { nodes: SharkKnowledgeNode[]; relations: SharkKnowledgeRelation[] } {
  if (!relation.relationId.trim() || !relation.fromNodeId.trim() || !relation.toNodeId.trim()) throw new Error('relation identity is required')
  if (!nodes.some(n => n.nodeId === relation.fromNodeId) || !nodes.some(n => n.nodeId === relation.toNodeId)) throw new Error('relation endpoints must exist')
  if (!Number.isFinite(relation.weight) || relation.weight < 0 || relation.weight > 1) throw new Error('relation weight must be between 0 and 1')
  if (relations.some(r => r.relationId === relation.relationId)) throw new Error('relation id already exists')
  return { nodes: [...nodes], relations: [...relations, { ...relation }] }
}

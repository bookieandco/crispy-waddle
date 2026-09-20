import type { KnowledgeNode, KnowledgeRelation } from './index.js'

export interface DurableKnowledgeGraphStore {
  appendNode(node: KnowledgeNode): Promise<'APPENDED' | 'DUPLICATE'>
  appendRelation(relation: KnowledgeRelation): Promise<'APPENDED' | 'DUPLICATE'>
  getNode(nodeId: string): Promise<KnowledgeNode | undefined>
  getRelations(nodeId: string): Promise<KnowledgeRelation[]>
}

export type KnowledgeGraphSqlClient = {
  query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>
}

export type PostgresKnowledgeGraphStoreOptions = {
  client: KnowledgeGraphSqlClient
  nodeTableName?: string
  relationTableName?: string
}

type NodeRow = {
  node_id: string
  node_type: string
  label: string
  attributes: Record<string, unknown> | null
  provenance_refs: string[]
  valid_from: string | null
  valid_to: string | null
}

type RelationRow = {
  relation_id: string
  from_node_id: string
  to_node_id: string
  relation_type: string
  attributes: Record<string, unknown> | null
  provenance_refs: string[]
  valid_from: string | null
  valid_to: string | null
}

const identifier = (value: string): string => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('KNOWLEDGE_GRAPH_TABLE_INVALID')
  return value
}

const nodeFromRow = (row: NodeRow): KnowledgeNode => ({
  nodeId: row.node_id,
  nodeType: row.node_type,
  label: row.label,
  ...(row.attributes ? { attributes: row.attributes } : {}),
  provenanceRefs: [...row.provenance_refs],
  validFrom: row.valid_from,
  validTo: row.valid_to,
})

const relationFromRow = (row: RelationRow): KnowledgeRelation => ({
  relationId: row.relation_id,
  fromNodeId: row.from_node_id,
  toNodeId: row.to_node_id,
  relationType: row.relation_type,
  ...(row.attributes ? { attributes: row.attributes } : {}),
  provenanceRefs: [...row.provenance_refs],
  validFrom: row.valid_from,
  validTo: row.valid_to,
})

const canonical = (value: unknown): string => JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort())

export class PostgresKnowledgeGraphStore implements DurableKnowledgeGraphStore {
  private readonly client: KnowledgeGraphSqlClient
  private readonly nodes: string
  private readonly relations: string

  constructor(options: PostgresKnowledgeGraphStoreOptions) {
    this.client = options.client
    this.nodes = identifier(options.nodeTableName ?? 'jhadina_knowledge_nodes')
    this.relations = identifier(options.relationTableName ?? 'jhadina_knowledge_relations')
  }

  async appendNode(node: KnowledgeNode): Promise<'APPENDED' | 'DUPLICATE'> {
    if (!node.nodeId || !node.nodeType || !node.label) throw new Error('KNOWLEDGE_NODE_INVALID')
    const result = await this.client.query<{ node_id: string }>(
      `INSERT INTO ${this.nodes} (node_id,node_type,label,attributes,provenance_refs,valid_from,valid_to)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7) ON CONFLICT (node_id) DO NOTHING RETURNING node_id`,
      [node.nodeId, node.nodeType, node.label, JSON.stringify(node.attributes ?? {}), JSON.stringify(node.provenanceRefs ?? []), node.validFrom ?? null, node.validTo ?? null],
    )
    if (result.rows[0]) return 'APPENDED'
    const existing = await this.getNode(node.nodeId)
    if (!existing) throw new Error('KNOWLEDGE_NODE_APPEND_UNCONFIRMED')
    const expected = { ...node, attributes: node.attributes ?? {}, provenanceRefs: node.provenanceRefs ?? [], validFrom: node.validFrom ?? null, validTo: node.validTo ?? null }
    const actual = { ...existing, attributes: existing.attributes ?? {}, provenanceRefs: existing.provenanceRefs ?? [], validFrom: existing.validFrom ?? null, validTo: existing.validTo ?? null }
    if (canonical(actual) !== canonical(expected)) throw new Error('KNOWLEDGE_NODE_ID_CONFLICT')
    return 'DUPLICATE'
  }

  async appendRelation(relation: KnowledgeRelation): Promise<'APPENDED' | 'DUPLICATE'> {
    if (!relation.relationId || !relation.fromNodeId || !relation.toNodeId || !relation.relationType) throw new Error('KNOWLEDGE_RELATION_INVALID')
    const result = await this.client.query<{ relation_id: string }>(
      `INSERT INTO ${this.relations} (relation_id,from_node_id,to_node_id,relation_type,attributes,provenance_refs,valid_from,valid_to)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8) ON CONFLICT (relation_id) DO NOTHING RETURNING relation_id`,
      [relation.relationId, relation.fromNodeId, relation.toNodeId, relation.relationType, JSON.stringify(relation.attributes ?? {}), JSON.stringify(relation.provenanceRefs ?? []), relation.validFrom ?? null, relation.validTo ?? null],
    )
    if (result.rows[0]) return 'APPENDED'
    const existing = (await this.getRelations(relation.fromNodeId)).find((item) => item.relationId === relation.relationId)
    if (!existing) throw new Error('KNOWLEDGE_RELATION_APPEND_UNCONFIRMED')
    const expected = { ...relation, attributes: relation.attributes ?? {}, provenanceRefs: relation.provenanceRefs ?? [], validFrom: relation.validFrom ?? null, validTo: relation.validTo ?? null }
    const actual = { ...existing, attributes: existing.attributes ?? {}, provenanceRefs: existing.provenanceRefs ?? [], validFrom: existing.validFrom ?? null, validTo: existing.validTo ?? null }
    if (canonical(actual) !== canonical(expected)) throw new Error('KNOWLEDGE_RELATION_ID_CONFLICT')
    return 'DUPLICATE'
  }

  async getNode(nodeId: string): Promise<KnowledgeNode | undefined> {
    const result = await this.client.query<NodeRow>(
      `SELECT node_id,node_type,label,attributes,provenance_refs,valid_from,valid_to FROM ${this.nodes} WHERE node_id=$1 LIMIT 1`,
      [nodeId],
    )
    return result.rows[0] ? nodeFromRow(result.rows[0]) : undefined
  }

  async getRelations(nodeId: string): Promise<KnowledgeRelation[]> {
    const result = await this.client.query<RelationRow>(
      `SELECT relation_id,from_node_id,to_node_id,relation_type,attributes,provenance_refs,valid_from,valid_to FROM ${this.relations}
       WHERE from_node_id=$1 OR to_node_id=$1 ORDER BY relation_id ASC`,
      [nodeId],
    )
    return result.rows.map(relationFromRow)
  }
}

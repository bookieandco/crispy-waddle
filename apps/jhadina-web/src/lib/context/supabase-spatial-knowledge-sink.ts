import type { SpatialGraphContribution, SpatialKnowledgeSink } from '@jhadina/spatial-intelligence-core'
import { createServiceRoleClient } from '../supabase/service-role'

type NodeRow = {
  node_id: string
  node_type: string
  label: string
  attributes: Record<string, unknown>
  provenance_refs: string[]
  valid_from: string | null
  valid_to: string | null
}

type RelationRow = {
  relation_id: string
  from_node_id: string
  to_node_id: string
  relation_type: string
  attributes: Record<string, unknown>
  provenance_refs: string[]
  valid_from: string | null
  valid_to: string | null
}

const stable = (value: unknown): string => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('SPATIAL_KNOWLEDGE_NON_FINITE_NUMBER')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stable(object[key])}`).join(',')}}`
  }
  throw new Error('SPATIAL_KNOWLEDGE_NON_JSON_VALUE')
}

const nodeRow = (contribution: SpatialGraphContribution, node: SpatialGraphContribution['nodes'][number]): NodeRow => ({
  node_id: node.ref,
  node_type: node.type,
  label: typeof node.attributes.name === 'string' && node.attributes.name.trim() ? node.attributes.name : node.ref,
  attributes: { ...node.attributes, spatial: true },
  provenance_refs: [...new Set(contribution.evidenceRefs)].sort(),
  valid_from: null,
  valid_to: null,
})

const relationRow = (edge: SpatialGraphContribution['edges'][number]): RelationRow => ({
  relation_id: edge.edgeId,
  from_node_id: edge.fromRef,
  to_node_id: edge.toRef,
  relation_type: edge.relation,
  attributes: { spatial: true },
  provenance_refs: [...new Set(edge.evidenceRefs)].sort(),
  valid_from: edge.validFrom,
  valid_to: edge.validTo,
})

/**
 * Server-only canonical KG sink. Duplicate identities are accepted only when
 * their stored canonical representation matches the attempted append.
 */
export function createSupabaseSpatialKnowledgeSink(): SpatialKnowledgeSink | undefined {
  const client = createServiceRoleClient()
  if (!client) return undefined

  return {
    async persist(contribution) {
      let nodes = 0
      let relations = 0

      for (const node of contribution.nodes) {
        const row = nodeRow(contribution, node)
        const { error } = await client.from('jhadina_knowledge_nodes').insert(row)
        if (!error) {
          nodes += 1
          continue
        }
        if (error.code !== '23505') throw new Error(`SPATIAL_KNOWLEDGE_NODE_APPEND_FAILED:${error.message}`)
        const { data, error: readError } = await client
          .from('jhadina_knowledge_nodes')
          .select('node_id,node_type,label,attributes,provenance_refs,valid_from,valid_to')
          .eq('node_id', row.node_id)
          .maybeSingle()
        if (readError) throw new Error(`SPATIAL_KNOWLEDGE_NODE_READ_FAILED:${readError.message}`)
        if (!data || stable(data as NodeRow) !== stable(row)) throw new Error('SPATIAL_KNOWLEDGE_NODE_ID_CONFLICT')
      }

      for (const edge of contribution.edges) {
        const row = relationRow(edge)
        const { error } = await client.from('jhadina_knowledge_relations').insert(row)
        if (!error) {
          relations += 1
          continue
        }
        if (error.code !== '23505') throw new Error(`SPATIAL_KNOWLEDGE_RELATION_APPEND_FAILED:${error.message}`)
        const { data, error: readError } = await client
          .from('jhadina_knowledge_relations')
          .select('relation_id,from_node_id,to_node_id,relation_type,attributes,provenance_refs,valid_from,valid_to')
          .eq('relation_id', row.relation_id)
          .maybeSingle()
        if (readError) throw new Error(`SPATIAL_KNOWLEDGE_RELATION_READ_FAILED:${readError.message}`)
        if (!data || stable(data as RelationRow) !== stable(row)) throw new Error('SPATIAL_KNOWLEDGE_RELATION_ID_CONFLICT')
      }

      return { nodes, relations }
    },
  }
}

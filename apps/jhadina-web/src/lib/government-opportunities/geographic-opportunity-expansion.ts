export type GeographicLevel = 'COUNTRY' | 'STATE' | 'COUNTY' | 'CITY' | 'AGENCY'

export interface GeographicNode {
  id: string
  level: GeographicLevel
  name: string
  parentId?: string
}

export interface GeographicOpportunitySignal {
  opportunityId: string
  capability: string
  geography: GeographicNode
  source: string
  sourceReference: string
  evidenceIds: string[]
  confidence: number
}

export interface GeographicExpansion {
  opportunityId: string
  path: GeographicNode[]
  levelsCovered: GeographicLevel[]
  capabilities: string[]
  evidenceIds: string[]
  confidence: number
}

const levelOrder: GeographicLevel[] = ['COUNTRY', 'STATE', 'COUNTY', 'CITY', 'AGENCY']

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** Builds a validated country → state → county → city → agency opportunity path. */
export function buildGeographicOpportunityExpansion(
  opportunityId: string,
  nodes: GeographicNode[],
  signals: GeographicOpportunitySignal[],
): GeographicExpansion {
  const relevant = signals.filter((signal) => signal.opportunityId === opportunityId)
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const signalNodeIds = new Set(relevant.map((signal) => signal.geography.id))
  const selected = new Map<string, GeographicNode>()

  for (const nodeId of signalNodeIds) {
    let current = nodeById.get(nodeId)
    const visited = new Set<string>()
    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      selected.set(current.id, current)
      current = current.parentId ? nodeById.get(current.parentId) : undefined
    }
  }

  const path = [...selected.values()].sort(
    (a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level) || a.name.localeCompare(b.name),
  )

  const confidences = relevant.map((signal) => clamp(signal.confidence))
  const confidence = confidences.length
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : 0

  return {
    opportunityId,
    path,
    levelsCovered: [...new Set(path.map((node) => node.level))].sort(
      (a, b) => levelOrder.indexOf(a) - levelOrder.indexOf(b),
    ),
    capabilities: [...new Set(relevant.map((signal) => signal.capability.trim()).filter(Boolean))].sort(),
    evidenceIds: [...new Set(relevant.flatMap((signal) => signal.evidenceIds))].sort(),
    confidence,
  }
}

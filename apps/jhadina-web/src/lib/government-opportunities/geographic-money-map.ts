export type MoneyMapLevel = 'COUNTRY' | 'STATE' | 'COUNTY' | 'CITY' | 'AGENCY' | 'DEPARTMENT'

export type MoneyMapNode = {
  id: string
  name: string
  level: MoneyMapLevel
  parentId?: string
  opportunityCount: number
  annualizedValue: number
  expectedValue: number
  priorityScore: number
  evidenceConfidence: number
}

export type MoneyMapRollup = MoneyMapNode & {
  childCount: number
  opportunityDensity: number
  captureDensity: number
}

function safe(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * Rolls opportunity intelligence up the geographic/entity hierarchy.
 * It does not invent opportunities or infer eligibility from geography.
 */
export function rollupMoneyMap(nodes: MoneyMapNode[]): MoneyMapRollup[] {
  const children = new Map<string, MoneyMapNode[]>()
  for (const node of nodes) {
    if (!node.parentId) continue
    const list = children.get(node.parentId) ?? []
    list.push(node)
    children.set(node.parentId, list)
  }

  return nodes.map((node) => {
    const descendants = children.get(node.id) ?? []
    const opportunityCount = safe(node.opportunityCount) + descendants.reduce((sum, child) => sum + safe(child.opportunityCount), 0)
    const annualizedValue = safe(node.annualizedValue) + descendants.reduce((sum, child) => sum + safe(child.annualizedValue), 0)
    const expectedValue = safe(node.expectedValue) + descendants.reduce((sum, child) => sum + safe(child.expectedValue), 0)
    const opportunityDensity = node.opportunityCount > 0 ? annualizedValue / node.opportunityCount : 0
    const captureDensity = node.opportunityCount > 0 ? expectedValue / node.opportunityCount : 0

    return {
      ...node,
      opportunityCount,
      annualizedValue,
      expectedValue,
      childCount: descendants.length,
      opportunityDensity,
      captureDensity,
    }
  })
}

export function rankMoneyMap(nodes: MoneyMapRollup[]): MoneyMapRollup[] {
  return [...nodes].sort((a, b) => {
    if (b.expectedValue !== a.expectedValue) return b.expectedValue - a.expectedValue
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore
    return b.evidenceConfidence - a.evidenceConfidence
  })
}

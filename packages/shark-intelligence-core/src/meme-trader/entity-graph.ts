export type GraphNodeKind = 'wallet' | 'developer' | 'organization' | 'cluster' | 'token'
export type GraphRelationKind = 'controls' | 'funded-by' | 'deployed' | 'provided-liquidity' | 'bought-early' | 'associated-with' | 'same-entity'

export type EntityGraphNode = { id: string; kind: GraphNodeKind; chainId?: string; observedAt: string; confidence: number; evidenceIds: string[] }
export type EntityGraphEdge = { id: string; from: string; to: string; relation: GraphRelationKind; observedAt: string; confidence: number; evidenceIds: string[] }
export type EntityGraph = { nodes: EntityGraphNode[]; edges: EntityGraphEdge[]; clusters: Array<{ clusterId: string; nodeIds: string[]; confidence: number; evidenceIds: string[] }> }

const clamp = (n: number) => Math.max(0, Math.min(1, n))
const assertObservedAt = (value: string) => { if (!value || Number.isNaN(Date.parse(value))) throw new Error('Invalid graph observation timestamp.') }

export function buildEntityGraph(nodes: EntityGraphNode[], edges: EntityGraphEdge[]): EntityGraph {
  const nodeMap = new Map<string, EntityGraphNode>()
  for (const node of nodes) {
    assertObservedAt(node.observedAt)
    if (!node.id || !node.kind) throw new Error('Graph nodes require id and kind.')
    nodeMap.set(node.id, { ...node, confidence: clamp(node.confidence), evidenceIds: [...new Set(node.evidenceIds)] })
  }
  const normalizedEdges = edges.map(edge => {
    assertObservedAt(edge.observedAt)
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) throw new Error(`Graph edge references unknown node: ${edge.id}`)
    return { ...edge, confidence: clamp(edge.confidence), evidenceIds: [...new Set(edge.evidenceIds)] }
  })
  const parent = new Map<string, string>()
  const find = (id: string): string => { const current = parent.get(id); if (!current) { parent.set(id, id); return id }; if (current === id) return id; const root = find(current); parent.set(id, root); return root }
  const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra) }
  for (const node of nodeMap.values()) find(node.id)
  for (const edge of normalizedEdges) if (['associated-with', 'same-entity', 'funded-by', 'controls'].includes(edge.relation)) union(edge.from, edge.to)
  const grouped = new Map<string, string[]>()
  for (const node of nodeMap.values()) { const root = find(node.id); const list = grouped.get(root) ?? []; list.push(node.id); grouped.set(root, list) }
  const clusters = [...grouped.entries()].filter(([, ids]) => ids.length > 1).map(([root, nodeIds]) => {
    const memberEdges = normalizedEdges.filter(e => nodeIds.includes(e.from) && nodeIds.includes(e.to))
    return { clusterId: `cluster:${root}`, nodeIds, confidence: memberEdges.length ? memberEdges.reduce((s, e) => s + e.confidence, 0) / memberEdges.length : 0, evidenceIds: [...new Set(memberEdges.flatMap(e => e.evidenceIds))] }
  })
  return { nodes: [...nodeMap.values()], edges: normalizedEdges, clusters }
}

export function deriveTokenActorGraph(input: { chainId: string; tokenAddress: string; observedAt: string; deployerWalletId?: string; funderWalletIds?: string[]; liquidityProviderWalletIds?: string[]; earlyBuyerWalletIds?: string[]; evidenceIds: string[] }): EntityGraph {
  const tokenId = `token:${input.chainId}:${input.tokenAddress}`
  const nodes: EntityGraphNode[] = [{ id: tokenId, kind: 'token', chainId: input.chainId, observedAt: input.observedAt, confidence: 1, evidenceIds: input.evidenceIds }]
  const edges: EntityGraphEdge[] = []
  const addWallet = (walletId: string, relation: GraphRelationKind) => {
    const walletIdKey = `wallet:${walletId}`
    nodes.push({ id: walletIdKey, kind: 'wallet', chainId: input.chainId, observedAt: input.observedAt, confidence: 1, evidenceIds: input.evidenceIds })
    edges.push({ id: `${relation}:${walletId}:${input.tokenAddress}`, from: walletIdKey, to: tokenId, relation, observedAt: input.observedAt, confidence: 1, evidenceIds: input.evidenceIds })
  }
  if (input.deployerWalletId) addWallet(input.deployerWalletId, 'deployed')
  for (const walletId of input.funderWalletIds ?? []) addWallet(walletId, 'funded-by')
  for (const walletId of input.liquidityProviderWalletIds ?? []) addWallet(walletId, 'provided-liquidity')
  for (const walletId of input.earlyBuyerWalletIds ?? []) addWallet(walletId, 'bought-early')
  return buildEntityGraph(nodes, edges)
}

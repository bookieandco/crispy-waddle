import type {
  FulfillmentProvider,
  FulfillmentProviderEvidenceRelationship,
} from './fulfillment-provider.js'

export type ProviderEvidenceGraphNodeType =
  | 'provider'
  | 'identifier'
  | 'capability'
  | 'naics'
  | 'psc'
  | 'credential'
  | 'geography'
  | 'past_performance'
  | 'award'
  | 'agency'
  | 'capacity'
  | 'opportunity'
  | 'evidence'

export type ProviderEvidenceGraphEdgeType =
  | 'has_identifier'
  | 'has_capability'
  | 'classified_as_naics'
  | 'classified_as_psc'
  | 'has_credential'
  | 'serves_geography'
  | 'has_past_performance'
  | 'performed_award'
  | 'award_by_agency'
  | 'has_capacity'
  | 'candidate_for'
  | 'supported_by'

export type ProviderEvidenceGraphNode = {
  id: string
  type: ProviderEvidenceGraphNodeType
  label: string
  providerId?: string
  evidenceRefs: string[]
  attributes?: Record<string, string | number | boolean | undefined>
}

export type ProviderEvidenceGraphEdge = {
  id: string
  fromId: string
  toId: string
  type: ProviderEvidenceGraphEdgeType
  confidence: number
  evidenceRefs: string[]
  observedAt?: string
}

export type ProviderEvidenceGraph = {
  nodes: ProviderEvidenceGraphNode[]
  edges: ProviderEvidenceGraphEdge[]
}

export type ProviderGraphAudit = {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export type ProviderGraphIntelligence = {
  providerId: string
  capabilityIds: string[]
  naicsCodes: string[]
  pscCodes: string[]
  credentialIds: string[]
  geographyIds: string[]
  pastPerformanceIds: string[]
  awardIds: string[]
  agencyIds: string[]
  evidenceIds: string[]
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function nodeId(kind: string, value: string): string {
  return `${kind}:${value.trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '-')}`
}

function addNode(graph: ProviderEvidenceGraph, node: ProviderEvidenceGraphNode): void {
  if (!graph.nodes.some((item) => item.id === node.id)) graph.nodes.push(node)
}

function addEdge(graph: ProviderEvidenceGraph, edge: ProviderEvidenceGraphEdge): void {
  if (!graph.edges.some((item) => item.id === edge.id)) graph.edges.push({ ...edge, confidence: clamp(edge.confidence) })
}

function evidenceConfidence(provider: FulfillmentProvider, refs: string[]): number {
  const evidence = provider.evidence.filter((item) => refs.includes(item.id))
  if (evidence.length === 0) return 0
  return evidence.reduce((sum, item) => sum + clamp(item.confidence), 0) / evidence.length
}

function supportRelationshipForNode(type: ProviderEvidenceGraphNodeType): FulfillmentProviderEvidenceRelationship | undefined {
  switch (type) {
    case 'provider':
    case 'identifier': return 'supports_identity'
    case 'capability':
    case 'naics':
    case 'psc': return 'supports_capability'
    case 'credential': return 'supports_credential'
    case 'geography': return 'supports_geography'
    case 'past_performance':
    case 'award':
    case 'agency': return 'supports_past_performance'
    case 'capacity': return 'supports_capacity'
    default: return undefined
  }
}

export function buildProviderEvidenceGraph(provider: FulfillmentProvider): ProviderEvidenceGraph {
  const graph: ProviderEvidenceGraph = { nodes: [], edges: [] }
  const providerNodeId = nodeId('provider', provider.id)
  const identityRefs = uniq(provider.identifiers.flatMap((item) => item.evidenceRefs))

  addNode(graph, {
    id: providerNodeId,
    type: 'provider',
    label: provider.legalName,
    providerId: provider.id,
    evidenceRefs: identityRefs,
    attributes: { verificationStatus: provider.verificationStatus, stage: provider.stage },
  })

  for (const evidence of provider.evidence) {
    addNode(graph, {
      id: nodeId('evidence', evidence.id),
      type: 'evidence',
      label: evidence.id,
      providerId: provider.id,
      evidenceRefs: [evidence.id],
      attributes: { kind: evidence.kind, relationship: evidence.relationship, sourceId: evidence.sourceId, confidence: evidence.confidence },
    })
  }

  const linkEvidence = (subject: ProviderEvidenceGraphNode) => {
    const expected = supportRelationshipForNode(subject.type)
    for (const ref of subject.evidenceRefs) {
      const evidence = provider.evidence.find((item) => item.id === ref)
      if (!evidence) continue
      addEdge(graph, {
        id: `edge:${subject.id}:supported-by:${ref}`,
        fromId: subject.id,
        toId: nodeId('evidence', ref),
        type: 'supported_by',
        confidence: expected && evidence.relationship !== expected ? 0 : clamp(evidence.confidence),
        evidenceRefs: [ref],
        observedAt: evidence.capturedAt,
      })
    }
  }

  for (const identifier of provider.identifiers) {
    const id = nodeId('identifier', `${identifier.type}:${identifier.value}`)
    const node: ProviderEvidenceGraphNode = { id, type: 'identifier', label: `${identifier.type.toUpperCase()} ${identifier.value}`, providerId: provider.id, evidenceRefs: identifier.evidenceRefs }
    addNode(graph, node)
    addEdge(graph, { id: `edge:${providerNodeId}:identifier:${id}`, fromId: providerNodeId, toId: id, type: 'has_identifier', confidence: evidenceConfidence(provider, identifier.evidenceRefs), evidenceRefs: identifier.evidenceRefs })
    linkEvidence(node)
  }

  for (const capability of provider.capabilities) {
    const id = nodeId('capability', capability.id)
    const node: ProviderEvidenceGraphNode = { id, type: 'capability', label: capability.name, providerId: provider.id, evidenceRefs: capability.evidenceRefs, attributes: { verified: capability.verified, confidence: capability.confidence } }
    addNode(graph, node)
    addEdge(graph, { id: `edge:${providerNodeId}:capability:${id}`, fromId: providerNodeId, toId: id, type: 'has_capability', confidence: Math.min(clamp(capability.confidence), evidenceConfidence(provider, capability.evidenceRefs)), evidenceRefs: capability.evidenceRefs })
    linkEvidence(node)

    for (const code of capability.naicsCodes) {
      const target = nodeId('naics', code)
      const naics: ProviderEvidenceGraphNode = { id: target, type: 'naics', label: code, providerId: provider.id, evidenceRefs: capability.evidenceRefs }
      addNode(graph, naics)
      addEdge(graph, { id: `edge:${id}:naics:${code}`, fromId: id, toId: target, type: 'classified_as_naics', confidence: evidenceConfidence(provider, capability.evidenceRefs), evidenceRefs: capability.evidenceRefs })
      linkEvidence(naics)
    }
    for (const code of capability.pscCodes) {
      const target = nodeId('psc', code)
      const psc: ProviderEvidenceGraphNode = { id: target, type: 'psc', label: code, providerId: provider.id, evidenceRefs: capability.evidenceRefs }
      addNode(graph, psc)
      addEdge(graph, { id: `edge:${id}:psc:${code}`, fromId: id, toId: target, type: 'classified_as_psc', confidence: evidenceConfidence(provider, capability.evidenceRefs), evidenceRefs: capability.evidenceRefs })
      linkEvidence(psc)
    }
  }

  for (const credential of provider.credentials) {
    const id = nodeId('credential', credential.id)
    const node: ProviderEvidenceGraphNode = { id, type: 'credential', label: credential.name, providerId: provider.id, evidenceRefs: credential.evidenceRefs, attributes: { kind: credential.kind, verified: credential.verified, issuer: credential.issuer } }
    addNode(graph, node)
    addEdge(graph, { id: `edge:${providerNodeId}:credential:${id}`, fromId: providerNodeId, toId: id, type: 'has_credential', confidence: evidenceConfidence(provider, credential.evidenceRefs), evidenceRefs: credential.evidenceRefs })
    linkEvidence(node)
  }

  provider.serviceAreas.forEach((area, index) => {
    const label = [area.country, area.state, area.county, area.locality].filter(Boolean).join('/')
    const id = nodeId('geography', label || String(index))
    const node: ProviderEvidenceGraphNode = { id, type: 'geography', label: label || 'unspecified', providerId: provider.id, evidenceRefs: area.evidenceRefs }
    addNode(graph, node)
    addEdge(graph, { id: `edge:${providerNodeId}:geography:${id}`, fromId: providerNodeId, toId: id, type: 'serves_geography', confidence: evidenceConfidence(provider, area.evidenceRefs), evidenceRefs: area.evidenceRefs })
    linkEvidence(node)
  })

  for (const performance of provider.pastPerformance) {
    const id = nodeId('past-performance', performance.id)
    const node: ProviderEvidenceGraphNode = { id, type: 'past_performance', label: performance.customer, providerId: provider.id, evidenceRefs: performance.evidenceRefs, attributes: { role: performance.role, amount: performance.amount, currency: performance.currency } }
    addNode(graph, node)
    addEdge(graph, { id: `edge:${providerNodeId}:performance:${id}`, fromId: providerNodeId, toId: id, type: 'has_past_performance', confidence: evidenceConfidence(provider, performance.evidenceRefs), evidenceRefs: performance.evidenceRefs })
    linkEvidence(node)

    if (performance.awardId) {
      const awardId = nodeId('award', performance.awardId)
      const award: ProviderEvidenceGraphNode = { id: awardId, type: 'award', label: performance.awardId, providerId: provider.id, evidenceRefs: performance.evidenceRefs, attributes: { amount: performance.amount, currency: performance.currency } }
      addNode(graph, award)
      addEdge(graph, { id: `edge:${id}:award:${awardId}`, fromId: id, toId: awardId, type: 'performed_award', confidence: evidenceConfidence(provider, performance.evidenceRefs), evidenceRefs: performance.evidenceRefs })
      linkEvidence(award)

      if (performance.agency) {
        const agencyId = nodeId('agency', performance.agency)
        const agency: ProviderEvidenceGraphNode = { id: agencyId, type: 'agency', label: performance.agency, providerId: provider.id, evidenceRefs: performance.evidenceRefs }
        addNode(graph, agency)
        addEdge(graph, { id: `edge:${awardId}:agency:${agencyId}`, fromId: awardId, toId: agencyId, type: 'award_by_agency', confidence: evidenceConfidence(provider, performance.evidenceRefs), evidenceRefs: performance.evidenceRefs })
        linkEvidence(agency)
      }
    }
  }

  const capacityRefs = provider.capacity.evidenceRefs
  const capacityId = nodeId('capacity', provider.id)
  const capacity: ProviderEvidenceGraphNode = { id: capacityId, type: 'capacity', label: provider.capacity.status, providerId: provider.id, evidenceRefs: capacityRefs, attributes: { workforceSize: provider.capacity.workforceSize, maxConcurrentProjects: provider.capacity.maxConcurrentProjects } }
  addNode(graph, capacity)
  addEdge(graph, { id: `edge:${providerNodeId}:capacity:${capacityId}`, fromId: providerNodeId, toId: capacityId, type: 'has_capacity', confidence: evidenceConfidence(provider, capacityRefs), evidenceRefs: capacityRefs })
  linkEvidence(capacity)

  return graph
}

export function auditProviderEvidenceGraph(graph: ProviderEvidenceGraph): ProviderGraphAudit {
  const errors: string[] = []
  const warnings: string[] = []
  const ids = new Set<string>()
  for (const node of graph.nodes) {
    if (ids.has(node.id)) errors.push(`Duplicate node id: ${node.id}`)
    ids.add(node.id)
  }
  for (const edge of graph.edges) {
    if (!ids.has(edge.fromId) || !ids.has(edge.toId)) errors.push(`Dangling edge: ${edge.id}`)
    if (edge.confidence < 0 || edge.confidence > 1) errors.push(`Invalid confidence: ${edge.id}`)
    if (edge.type !== 'candidate_for' && edge.evidenceRefs.length === 0) warnings.push(`Unproven edge: ${edge.id}`)
    if (edge.type === 'supported_by' && edge.confidence === 0) errors.push(`Evidence relationship mismatch: ${edge.id}`)
  }
  return { valid: errors.length === 0, errors, warnings }
}

export function getProviderGraphIntelligence(graph: ProviderEvidenceGraph, providerId: string): ProviderGraphIntelligence {
  const root = graph.nodes.find((node) => node.type === 'provider' && node.providerId === providerId)
  if (!root) return { providerId, capabilityIds: [], naicsCodes: [], pscCodes: [], credentialIds: [], geographyIds: [], pastPerformanceIds: [], awardIds: [], agencyIds: [], evidenceIds: [] }
  const reachable = new Set<string>([root.id])
  let changed = true
  while (changed) {
    changed = false
    for (const edge of graph.edges) {
      if (reachable.has(edge.fromId) && !reachable.has(edge.toId)) {
        reachable.add(edge.toId)
        changed = true
      }
    }
  }
  const nodes = graph.nodes.filter((node) => reachable.has(node.id))
  const labels = (type: ProviderEvidenceGraphNodeType) => uniq(nodes.filter((node) => node.type === type).map((node) => node.label))
  const ids = (type: ProviderEvidenceGraphNodeType) => uniq(nodes.filter((node) => node.type === type).map((node) => node.id))
  return {
    providerId,
    capabilityIds: ids('capability'),
    naicsCodes: labels('naics'),
    pscCodes: labels('psc'),
    credentialIds: ids('credential'),
    geographyIds: ids('geography'),
    pastPerformanceIds: ids('past_performance'),
    awardIds: ids('award'),
    agencyIds: ids('agency'),
    evidenceIds: labels('evidence'),
  }
}

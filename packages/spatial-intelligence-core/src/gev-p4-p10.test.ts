import test from 'node:test'
import assert from 'node:assert/strict'
import { GevProviderBridge, type GevFetchLike } from './gev-provider-bridge.js'
import { createGevSpatialContextReadProvider } from './gev-spatial-context-read-provider.js'
import { inferSpatialDomains, normalizeGevCamera, type SpatialContextPackage } from './integration.js'
import { projectSpatialContributionToKnowledgeGraph } from './spatial-knowledge-projection.js'
import { InMemorySpatialWorkspaceStore, createSpatialWorkspaceRevision } from './spatial-workspace-store.js'
import { applyJanetSpatialPreferences, composeDeliaSpatialAssessment, prepareMarisaSpatialOperation } from './spatial-role-composition.js'
import { toMoneySpatialIntelligence, toSafetySpatialIntelligence } from './spatial-consumer-adapters.js'
import { runSpatialPerception, type SpatialPerceptionAdapter } from './spatial-perception.js'
import { type SpatialWorkspace, planSpatialQuery } from './spatial-pipeline.js'
import { evaluateSpatialRealityAdmission } from './reality-admission.js'
import { InMemorySpatialEvidenceStore } from './evidence-store.js'

const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() { return body },
  async text() { return typeof body === 'string' ? body : JSON.stringify(body) },
})

function liveFetch(): GevFetchLike {
  return async (url) => {
    const parsed = new URL(url)
    if (parsed.pathname === '/api/cctv/sources') {
      return response({ sources: [{ id: 'cam-near', name: 'Near Camera', provider: 'Public CCTV', lat: 34, lon: -117, sourceKind: 'configured', feedType: 'image' }] })
    }
    if (parsed.pathname === '/api/cctv/health') {
      return response({ cameras: [{ id: 'cam-near', status: 'degraded', sourceKind: 'streetview', label: 'Google Street View', message: 'Fallback Street View frame', updatedAt: Date.parse('2026-09-19T19:59:30Z') }] })
    }
    if (parsed.pathname === '/api/opensky') {
      return response({ time: 1_758_312_000, states: [['abc123', 'TEST1', 'US', null, 1_758_311_990, -117.2, 33.9, 1000, false, 100, 90, 0, null, 1000, '1200', false, 0, 3]] })
    }
    if (parsed.pathname === '/api/ais-live') {
      return response({ source: 'AISStream', status: 'live', rows: [{ mmsi: '123456789', lat: 33.8, lon: -118.2, timestamp: '2026-09-19T19:59:00Z' }] })
    }
    if (parsed.pathname === '/api/firms') {
      return response({ stale: false, fires: [{ latitude: 34.1, longitude: -117.4, acq_date: '2026-09-19', acq_time: '1955', satellite: 'NOAA-20' }] })
    }
    return response({ error: 'not_found' }, 404)
  }
}

const emptyContext = (): SpatialContextPackage => ({
  subject: 'test',
  geographicScope: null,
  temporalScope: { from: null, to: null, asOf: null },
  observations: [{ id: 'o1', source: 'source', observedAt: '2026-09-19T20:00:00Z', summary: 'observation', immutable: true }],
  evidence: [{ id: 'e1', source: 'source', observedAt: '2026-09-19T20:00:00Z', summary: 'evidence', immutable: true }],
  claims: [],
  reality: [{ id: 'r1', source: 'reality', observedAt: '2026-09-19T20:00:00Z', summary: 'admitted reality', immutable: true }],
  patterns: [],
  predictions: [{ id: 'p1', source: 'prediction', observedAt: '2026-09-19T20:00:00Z', summary: 'possible disruption', immutable: true }],
  scenarios: [],
  hypotheses: [{ id: 'h1', source: 'hypothesis', observedAt: '2026-09-19T20:00:00Z', summary: 'alternate explanation', immutable: true }],
  sourceHealth: ['camera:available:1'],
  conflicts: ['source disagreement'],
  uncertainty: ['coverage partial'],
  limitations: ['test limitation'],
  workspaceRef: 'workspace-1',
  investigationRef: null,
  provenance: [{ id: 'e1', source: 'source', observedAt: '2026-09-19T20:00:00Z', summary: 'evidence', immutable: true }],
})

test('GEV P4 query planning selects source domains rather than always fetching the whole world', () => {
  assert.deepEqual(inferSpatialDomains('show cameras and aircraft near the airport'), ['aircraft', 'camera'])
  assert.deepEqual(inferSpatialDomains('what is happening near here?'), ['spatial'])
})

test('GEV P4 live read provider produces evidence but cannot self-admit claims or reality', async () => {
  const bridge = new GevProviderBridge({ baseUrl: 'https://gev.example', fetchImpl: liveFetch() })
  const evidenceStore = new InMemorySpatialEvidenceStore()
  const provider = createGevSpatialContextReadProvider({ bridge, evidenceStore, now: () => '2026-09-19T20:00:00Z' })
  const plan = planSpatialQuery({
    queryId: 'q-e2e',
    kind: 'OBSERVE',
    subject: 'nearby spatial context',
    geographicScope: { lat: 34, lon: -117, radiusKm: 60 },
    temporalScope: { from: null, to: null, asOf: null },
    requestedDomains: ['spatial'],
    requiresEvidence: true,
  })
  const context = await provider.read(plan, 'user-1')
  assert.ok(context)
  assert.ok((context?.evidence.length ?? 0) >= 2)
  assert.equal(context?.claims.length, 0)
  assert.equal(context?.reality.length, 0)
  assert.ok(context?.observations.every((item) => item.immutable))
  assert.ok(context?.provenance.every((item) => item.immutable))
  assert.ok(context?.limitations.some((item) => item.includes('No named-person search')))
  assert.ok(context?.sourceHealth.includes('camera-health:available:1'))
  const cameraRef = context?.evidence.find((item) => item.summary.includes('camera observation cam-near'))
  assert.ok(cameraRef)
  const cameraEvidence = await evidenceStore.get(cameraRef!.id)
  assert.equal(cameraEvidence?.timing.observedAt, '2026-09-19T19:59:30.000Z')
  assert.equal(cameraEvidence?.payload.attributes.sourceKind, 'streetview')
  assert.equal(cameraEvidence?.payload.attributes.catalogSourceKind, 'configured')
  assert.equal(cameraEvidence?.payload.attributes.healthStatus, 'degraded')
  assert.equal(cameraEvidence?.payload.attributes.fallbackActive, true)
  assert.equal(cameraEvidence?.payload.attributes.timestampSemantics, 'provider-health-updated-at')
})

test('GEV P5 workspace history is append-only and supports deterministic replay at a timestamp', async () => {
  const store = new InMemorySpatialWorkspaceStore()
  const base: SpatialWorkspace = {
    workspaceId: 'workspace-1', ownerId: 'user-1', geographicScope: { place: 'test' }, selectedRefs: [], activeLayers: ['camera'], filters: {},
    routes: [], annotations: [], measurements: [], timeCursor: null, replayState: 'LIVE', investigationRefs: [], activeClaimRefs: [],
    evidenceRefs: ['e1'], realityRefs: ['r1'], janetPreferences: {}, deliaContext: {}, marisaContext: {}, createdAt: '2026-09-19T19:00:00Z', updatedAt: '2026-09-19T19:00:00Z',
  }
  const first = createSpatialWorkspaceRevision(base, 'created', '2026-09-19T19:00:00Z')
  const second = createSpatialWorkspaceRevision({ ...base, activeLayers: ['camera', 'fire'], updatedAt: '2026-09-19T20:00:00Z' }, 'layers changed', '2026-09-19T20:00:00Z')
  assert.equal(await store.append(first), 'APPENDED')
  assert.equal(await store.append(second), 'APPENDED')
  assert.equal((await store.latest('workspace-1', 'user-1'))?.reason, 'layers changed')
  assert.equal((await store.atOrBefore('workspace-1', 'user-1', '2026-09-19T19:30:00Z'))?.reason, 'created')
})

test('GEV P6 spatial graph projects into the canonical knowledge graph with provenance', () => {
  const nodes = new Map<string, { nodeId: string; nodeType: string; label: string; provenanceRefs?: string[] }>()
  const graph = {
    registerNode(node: { nodeId: string; nodeType: string; label: string; provenanceRefs?: string[] }) { nodes.set(node.nodeId, node) },
    registerRelation(_relation: unknown) {},
    getNode(nodeId: string) { return nodes.get(nodeId) },
    getRelations(_nodeId: string) { return [] },
  }
  const contribution = normalizeGevCamera({ id: 'cam-1', name: 'Camera', city: 'Austin', lat: 30.2, lon: -97.7 }, 'gev-cctv', 'v1')
  contribution.evidenceRefs.push('e-camera-1')
  projectSpatialContributionToKnowledgeGraph(graph, contribution)
  const node = graph.getNode('camera:cam-1')
  assert.equal(node?.nodeType, 'camera')
  assert.ok(node?.provenanceRefs?.includes('e-camera-1'))
})

test('GEV P7 JANET cannot change truth lineage; DELIA is intelligence-only; MARISA requires policy approval', () => {
  const workspace: SpatialWorkspace = {
    workspaceId: 'workspace-1', ownerId: 'user-1', geographicScope: null, selectedRefs: [], activeLayers: ['camera'], filters: {},
    routes: [], annotations: [], measurements: [], timeCursor: null, replayState: 'LIVE', investigationRefs: [], activeClaimRefs: [],
    evidenceRefs: ['e1'], realityRefs: ['r1'], janetPreferences: {}, deliaContext: {}, marisaContext: {}, createdAt: '2026-09-19T19:00:00Z', updatedAt: '2026-09-19T19:00:00Z',
  }
  const personalized = applyJanetSpatialPreferences(workspace, { activeLayers: ['fire'], display: { density: 'compact' } })
  assert.deepEqual(personalized.evidenceRefs, ['e1'])
  assert.deepEqual(personalized.realityRefs, ['r1'])
  const delia = composeDeliaSpatialAssessment(emptyContext())
  assert.equal(delia.authority, 'INTELLIGENCE_ONLY')
  const marisa = prepareMarisaSpatialOperation({ workspaceRef: 'workspace-1', capability: 'consequential.outreach', operation: 'notify', purpose: 'test', evidenceRefs: ['e1'], realityRefs: ['r1'] })
  assert.equal(marisa.status, 'REQUIRES_POLICY_APPROVAL')
  assert.equal(marisa.context.approved, false)
})

test('GEV P8 cross-subsystem projections stay intelligence-only', () => {
  const context = emptyContext()
  const money = toMoneySpatialIntelligence(context)
  const safety = toSafetySpatialIntelligence(context)
  assert.equal(money.authority, 'INTELLIGENCE_ONLY')
  assert.ok(money.prohibitedUses.includes('trade-execution'))
  assert.ok(safety.prohibitedUses.includes('face-recognition'))
  assert.deepEqual(money.reality.map((item) => item.id), ['r1'])
})

test('GEV P9 camera model input fails closed under aggregate CCTV policy', async () => {
  const adapter: SpatialPerceptionAdapter = { analyze: async () => ({ summary: 'unused', detections: [] }) }
  await assert.rejects(
    () => runSpatialPerception({
      sourceId: 'gev-cctv', frameEvidenceRef: 'e-camera', operation: 'describe', model: 'vision', modelVersion: '1', approvedForIncidentalPersonalData: true, payloadRef: 'frame:1',
    }, adapter),
    /SPATIAL_PERCEPTION_MODEL_INPUT_NOT_ALLOWED/,
  )
})

test('GEV P9 permitted source perception remains explicitly inferred and never canonical reality', async () => {
  const adapter: SpatialPerceptionAdapter = {
    analyze: async () => ({ summary: 'thermal anomaly candidate', detections: [{ label: 'hotspot', confidence: 0.82 }] }),
  }
  const result = await runSpatialPerception({
    sourceId: 'gev-firms', frameEvidenceRef: 'e-fire', operation: 'classify', model: 'vision', modelVersion: '1', approvedForIncidentalPersonalData: false, payloadRef: 'image:fire',
  }, adapter, undefined, '2026-09-19T20:00:00Z')
  assert.equal(result.determination, 'INFERRED')
  assert.equal(result.canonicalReality, false)
  assert.deepEqual(result.sourceEvidenceRefs, ['e-fire'])
})

test('GEV P10 conformance keeps prediction, evidence, and admitted reality distinct across consumer and reasoning paths', () => {
  const context = emptyContext()
  const delia = composeDeliaSpatialAssessment(context)
  const money = toMoneySpatialIntelligence(context)
  assert.deepEqual(delia.scenarios, ['possible disruption'])
  assert.deepEqual(money.reality.map((item) => item.summary), ['admitted reality'])
  assert.ok(!money.reality.some((item) => item.id === 'p1'))
  assert.ok(delia.evidenceRefs.includes('r1'))
})

test('GEV P10 reality admission is explicit: fallback-only defers, non-fallback evidence can be admitted', () => {
  const candidate = {
    candidateId: 'candidate-1',
    entityId: 'camera:cam-1',
    state: { status: 'observed' },
    determination: 'observed' as const,
    evidenceRefs: ['e-fallback'],
    observationRefs: ['o1'],
    fusionRefs: [],
    createdAt: '2026-09-19T20:00:00Z',
    validFrom: '2026-09-19T20:00:00Z',
    validTo: null,
    limitations: [],
  }
  const fallbackOnly = evaluateSpatialRealityAdmission({
    candidate,
    verifier: 'p10-verifier',
    evidenceAvailable: new Set(['e-fallback']),
    fallbackEvidenceRefs: new Set(['e-fallback']),
    createdAt: '2026-09-19T20:00:01Z',
  })
  assert.equal(fallbackOnly.decision, 'DEFER')
  assert.ok(fallbackOnly.rationale.includes('SPATIAL_REALITY_NON_FALLBACK_EVIDENCE_REQUIRED'))

  const admitted = evaluateSpatialRealityAdmission({
    candidate: { ...candidate, candidateId: 'candidate-2', evidenceRefs: ['e-source'] },
    verifier: 'p10-verifier',
    evidenceAvailable: new Set(['e-source']),
    fallbackEvidenceRefs: new Set(),
    createdAt: '2026-09-19T20:00:01Z',
  })
  assert.equal(admitted.decision, 'ACCEPT')
})

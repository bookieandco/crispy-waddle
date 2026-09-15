import assert from 'node:assert/strict'
import test from 'node:test'
import { assertGevStreamForAdapter, defaultSpatialQueryInterpreter, finalSpatialReadinessGate, normalizeGevCamera, normalizeSpatialGraphContribution, planSpatialQuery, reasonOverSpatialContext, workspaceSnapshot } from './integration.js'

test('spatial query interpretation is conservative and read-only', () => {
  const query = defaultSpatialQueryInterpreter('What changed around LAX?')
  assert.equal(query?.kind, 'COMPARE')
  assert.equal(planSpatialQuery(query!).capability, 'READ_SPATIAL_CONTEXT')
})

test('spatial graph normalization is deterministic and deduplicates evidence', () => {
  const out = normalizeSpatialGraphContribution({
    nodes: [{ ref: 'b', type: 'camera', attributes: {} }, { ref: 'a', type: 'location', attributes: {} }],
    edges: [{ edgeId: 'e', fromRef: 'a', toRef: 'b', relation: 'observed_by', evidenceRefs: ['z', 'z', 'a'], validFrom: null, validTo: null }],
    evidenceRefs: ['z', 'a', 'a'], limitations: ['x'],
  })
  assert.deepEqual(out.nodes.map(x => x.ref), ['a', 'b'])
  assert.deepEqual(out.edges[0].evidenceRefs, ['a', 'z'])
  assert.deepEqual(out.evidenceRefs, ['a', 'z'])
})

test('GEV camera normalization does not import renderer state', () => {
  const out = normalizeGevCamera({ id: 'cam-1', name: 'Camera 1', city: 'Austin', lat: 30.2, lon: -97.7 }, 'gev-cctv', '1')
  assert.equal(out.nodes[0].type, 'camera')
  assert.match(out.limitations[0], /coverage geometry is not proof/i)
})

test('GEV stream adapter fails closed for unknown/offline capability', () => {
  assert.throws(() => assertGevStreamForAdapter({ streamId: 's', sourceId: 'c', capability: 'UNKNOWN', endpoint: '/x', attribution: 'a', adapterVersion: '1', allowlisted: true, licensedForReplay: false }), /SPATIAL_STREAM_NOT_READABLE/)
  assert.throws(() => assertGevStreamForAdapter({ streamId: 's', sourceId: 'c', capability: 'LIVE_STREAM', endpoint: '/x', attribution: 'a', adapterVersion: '1', allowlisted: false, licensedForReplay: false }), /SPATIAL_STREAM_ENDPOINT_NOT_ALLOWLISTED/)
})

test('DELIA reasoning consumes context without creating authority', () => {
  const result = reasonOverSpatialContext({
    subject: 'LAX', geographicScope: null, temporalScope: { from: null, to: null, asOf: null },
    observations: [{ id: 'o', source: 'gev', observedAt: null, summary: 'observed', immutable: true }],
    evidence: [{ id: 'e', source: 'gev', observedAt: null, summary: 'frame', immutable: true }],
    claims: [], reality: [{ id: 'r', source: 'reality', observedAt: null, summary: 'admitted', immutable: true }],
    patterns: [], predictions: [{ id: 'p', source: 'model', observedAt: null, summary: 'scenario', immutable: false }],
    scenarios: [], hypotheses: [{ id: 'h', source: 'analysis', observedAt: null, summary: 'alternative', immutable: false }],
    sourceHealth: [], conflicts: ['source disagreement'], uncertainty: ['limited coverage'], limitations: [], workspaceRef: null, investigationRef: null, provenance: [],
  })
  assert.deepEqual(result.scenarios, ['scenario'])
  assert.deepEqual(result.risks, ['source disagreement'])
  assert.ok(result.evidenceRefs.includes('r'))
})

test('workspace snapshot is defensive', () => {
  const workspace = { workspaceId: 'w', ownerId: 'u', geographicScope: null, selectedRefs: ['a'], activeLayers: ['cctv'], filters: {}, routes: [], annotations: [], measurements: [], timeCursor: null, replayState: 'LIVE' as const, investigationRefs: [], activeClaimRefs: [], evidenceRefs: ['e'], realityRefs: ['r'], janetPreferences: {}, deliaContext: {}, marisaContext: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  const copy = workspaceSnapshot(workspace)
  copy.selectedRefs.push('b')
  assert.deepEqual(workspace.selectedRefs, ['a'])
})

test('final spatial readiness gate fails closed when integration evidence is unknown', () => {
  const report = finalSpatialReadinessGate({ id: 'SPATIAL-16', checks: [
    { id: 'contracts', result: 'PASS', rationale: 'provider-neutral contracts exist' },
    { id: 'gev-adapter', result: 'UNKNOWN', rationale: 'adapter contract exists but live conformance is not verified' },
    { id: 'production', result: 'UNKNOWN', rationale: 'deployment and operational evidence not verified' },
  ] })
  assert.equal(report.architectureComplete, false)
  assert.equal(report.implementationComplete, false)
  assert.equal(report.productionReady, false)
})

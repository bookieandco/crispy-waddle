import assert from 'node:assert/strict'
import { createFulfillmentProvider } from './fulfillment-provider.js'
import { auditProviderEvidenceGraph, buildProviderEvidenceGraph, getProviderGraphIntelligence } from './provider-evidence-graph.js'

const provider = createFulfillmentProvider({
  id: 'provider:acme',
  legalName: 'Acme LLC',
  identifiers: [{ type: 'uei', value: 'UEI123', verified: true, evidenceRefs: ['ev-id'] }],
  serviceAreas: [{ country: 'US', state: 'CA', evidenceRefs: ['ev-geo'] }],
  capabilities: [{ id: 'cap:cloud', name: 'Cloud', naicsCodes: ['541512'], pscCodes: ['DA01'], keywords: ['cloud'], confidence: 0.9, verified: true, evidenceRefs: ['ev-cap'] }],
  credentials: [{ id: 'cred:sam', kind: 'registration', name: 'SAM', verified: true, evidenceRefs: ['ev-cred'] }],
  pastPerformance: [{ id: 'perf:1', role: 'subcontractor', customer: 'Prime Co', agency: 'Agency X', awardId: 'AWD-1', amount: 1000, currency: 'USD', capabilityIds: ['cap:cloud'], verified: true, evidenceRefs: ['ev-award'] }],
  capacity: { status: 'available', workforceSize: 10, evidenceRefs: ['ev-capacity'] },
  evidence: [
    { id: 'ev-id', kind: 'sam_registration', relationship: 'supports_identity', sourceId: 'sam', capturedAt: '2026-09-20T00:00:00Z', confidence: 1 },
    { id: 'ev-geo', kind: 'official_source', relationship: 'supports_geography', sourceId: 'sam', capturedAt: '2026-09-20T00:00:00Z', confidence: 1 },
    { id: 'ev-cap', kind: 'capability_record', relationship: 'supports_capability', sourceId: 'statement', capturedAt: '2026-09-20T00:00:00Z', confidence: 0.9 },
    { id: 'ev-cred', kind: 'sam_registration', relationship: 'supports_credential', sourceId: 'sam', capturedAt: '2026-09-20T00:00:00Z', confidence: 1 },
    { id: 'ev-award', kind: 'award_record', relationship: 'supports_past_performance', sourceId: 'usaspending', capturedAt: '2026-09-20T00:00:00Z', confidence: 1 },
    { id: 'ev-capacity', kind: 'capacity_record', relationship: 'supports_capacity', sourceId: 'attestation', capturedAt: '2026-09-20T00:00:00Z', confidence: 0.6 },
  ],
  sourceIds: ['sam', 'usaspending'],
  riskFlags: [],
})

const graph = buildProviderEvidenceGraph(provider)
const audit = auditProviderEvidenceGraph(graph)
assert.equal(audit.valid, true)
assert.equal(audit.errors.length, 0)

const intel = getProviderGraphIntelligence(graph, provider.id)
assert.deepEqual(intel.naicsCodes, ['541512'])
assert.deepEqual(intel.pscCodes, ['DA01'])
assert.equal(intel.awardIds.length, 1)
assert.equal(intel.agencyIds.length, 1)
assert.ok(intel.evidenceIds.includes('ev-award'))

const bad = structuredClone(graph)
const capability = bad.nodes.find((node) => node.type === 'capability')
assert.ok(capability)
const support = bad.edges.find((edge) => edge.type === 'supported_by' && edge.fromId === capability.id)
assert.ok(support)
support.confidence = 0
const badAudit = auditProviderEvidenceGraph(bad)
assert.equal(badAudit.valid, false)
assert.ok(badAudit.errors.some((error) => error.includes('Evidence relationship mismatch')))

console.log('provider-evidence-graph tests passed')

import assert from 'node:assert/strict'
import test from 'node:test'
import { createObservationEnvelope } from './observation.js'

test('normalizes passive evidence without granting trust or authorization', () => {
  const envelope = createObservationEnvelope({
    observationId: 'obs-1',
    subjectId: 'host:example',
    source: { provider: 'example-provider', capability: 'host.read', adapterVersion: '1' },
    provenance: {
      observedAt: '2026-09-19T00:00:00.000Z',
      receivedAt: '2026-09-19T00:00:01.000Z',
      evidenceRefs: ['provider:record:1'],
    },
    payload: { ports: [443] },
    limitations: { freshness: 'delayed', limitations: ['provider observation; not independently verified'] },
  })

  assert.equal(envelope.trustEffect, 'NONE')
  assert.equal(envelope.authorizationEffect, 'NONE')
  assert.equal(envelope.source.capability, 'host.read')
  assert.deepEqual(envelope.provenance.evidenceRefs, ['provider:record:1'])
})

test('fails closed when identity/source/provenance is missing', () => {
  assert.throws(() => createObservationEnvelope({
    observationId: '',
    subjectId: 'subject',
    source: { provider: 'provider', capability: 'read', adapterVersion: '1' },
    provenance: { observedAt: 'now', receivedAt: 'now', evidenceRefs: [] },
    payload: {},
  }), /OBSERVATION_ID_REQUIRED/)

  assert.throws(() => createObservationEnvelope({
    observationId: 'obs',
    subjectId: 'subject',
    source: { provider: '', capability: 'read', adapterVersion: '1' },
    provenance: { observedAt: 'now', receivedAt: 'now', evidenceRefs: [] },
    payload: {},
  }), /OBSERVATION_SOURCE_REQUIRED/)
})


test('rejects malformed provenance timestamps before evidence can be persisted', () => {
  assert.throws(() => createObservationEnvelope({
    observationId: 'obs-time',
    subjectId: 'subject',
    source: { provider: 'provider', capability: 'read', adapterVersion: '1' },
    provenance: { observedAt: 'not-a-time', receivedAt: '2026-09-20T00:00:00.000Z', evidenceRefs: [] },
    payload: {},
  }), /OBSERVATION_PROVENANCE_TIMESTAMP_INVALID/)
})

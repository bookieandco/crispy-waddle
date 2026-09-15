import test from 'node:test';
import assert from 'node:assert/strict';
import { DIRECTOR_SPATIAL_CAPABILITIES, assertSpatialStream, fuseSpatialObservations, planSpatialQuery, rankSpatialAttention } from './spatial-pipeline.js';

test('fusion corroborates independent agreeing observations', () => {
  const result = fuseSpatialObservations([
    { observationId: 'o2', entityId: 'aircraft-1', sourceId: 'adsb', observedAt: '2026-01-01T00:00:00Z', position: { lat: 33.94, lon: -118.4 }, evidenceRefs: ['e2'], sourceIndependence: 'INDEPENDENT' },
    { observationId: 'o1', entityId: 'aircraft-1', sourceId: 'camera', observedAt: '2026-01-01T00:00:01Z', position: { lat: 33.9401, lon: -118.4001 }, evidenceRefs: ['e1'], sourceIndependence: 'INDEPENDENT' },
  ], { temporalOverlapMs: 5000, spatialAgreementMeters: 100 }, '2026-01-01T00:00:02Z', 'f1');
  assert.equal(result.relation, 'CORROBORATING');
  assert.equal(result.determination, 'CORROBORATED');
  assert.deepEqual(result.observationRefs, ['o1', 'o2']);
});

test('fusion refuses duplicate-source corroboration', () => {
  const result = fuseSpatialObservations([
    { observationId: 'a', entityId: 'x', sourceId: 'same', observedAt: null, position: null, evidenceRefs: [] },
    { observationId: 'b', entityId: 'x', sourceId: 'same', observedAt: null, position: null, evidenceRefs: [] },
  ], { temporalOverlapMs: 1, spatialAgreementMeters: 1 }, '2026-01-01T00:00:00Z');
  assert.equal(result.relation, 'DUPLICATE_SOURCE');
  assert.equal(result.determination, 'UNRESOLVED');
});

test('attention is deterministic and does not change determination fields', () => {
  const result = rankSpatialAttention([
    { ref: 'b', category: 'ENTITY', reasons: ['scope'], evidenceRefs: ['e2'], limitations: [], scopeMatch: true, temporalMatch: true, changed: false, conflict: false, investigationTarget: false, preferenceMatch: true },
    { ref: 'a', category: 'CONFLICT', reasons: ['conflict'], evidenceRefs: ['e1'], limitations: ['unknown'], scopeMatch: true, temporalMatch: true, changed: true, conflict: true, investigationTarget: false, preferenceMatch: false },
  ], 'attention-v1');
  assert.deepEqual(result.items.map(x => x.ref), ['a', 'b']);
  assert.deepEqual(result.items[0].evidenceRefs, ['e1']);
});

test('query planning produces read-only spatial capability', () => {
  const plan = planSpatialQuery({ queryId: 'q1', kind: 'OBSERVE', subject: 'LAX', geographicScope: { place: 'LAX' }, temporalScope: { from: null, to: null, asOf: null }, requestedDomains: ['traffic', 'camera', 'traffic'], requiresEvidence: true });
  assert.equal(plan.capability, 'READ_SPATIAL_CONTEXT');
  assert.deepEqual(plan.domains, ['camera', 'traffic']);
});

test('stream registry boundary requires allowlisted endpoints', () => {
  assert.throws(() => assertSpatialStream({ streamId: 's', sourceId: 'c', capability: 'CONTINUOUS_STREAM', endpoint: 'https://x', attribution: 'source', adapterVersion: '1', allowlisted: false, licensedForReplay: false }), /NOT_ALLOWLISTED/);
});

test('director receives provider-neutral spatial capabilities only', () => {
  assert.ok(DIRECTOR_SPATIAL_CAPABILITIES.includes('observe_scene'));
  assert.ok(DIRECTOR_SPATIAL_CAPABILITIES.includes('request_video_window'));
  assert.equal(DIRECTOR_SPATIAL_CAPABILITIES.includes('execute_action' as never), false);
});

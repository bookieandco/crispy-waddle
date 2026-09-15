import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  assertSpatialTemporal,
  classifySpatialFreshness,
  computeTemporalGap,
  deriveContinuity,
  normalizeSpatialTemporal,
} from './temporal.js';

test('preserves observation time separately from receipt time', () => {
  const temporal = normalizeSpatialTemporal({
    observedAt: '2026-09-14T20:00:00.000Z',
    receivedAt: '2026-09-14T20:00:03.000Z',
    relation: 'observation',
    sourceHistory: false,
  });

  assert.equal(temporal.observedAt, '2026-09-14T20:00:00.000Z');
  assert.equal(temporal.receivedAt, '2026-09-14T20:00:03.000Z');
  assert.equal(temporal.continuity, 'unknown');
});

test('does not let predictions masquerade as observed world time', () => {
  assert.throws(
    () => assertSpatialTemporal({
      observedAt: '2026-09-14T20:00:00.000Z',
      receivedAt: '2026-09-14T19:59:00.000Z',
      relation: 'predicted',
      sourceHistory: false,
    }),
    /PREDICTION_CANNOT_BE_OBSERVATION_TIME/,
  );
});

test('computes gaps only from known observation times', () => {
  assert.equal(
    computeTemporalGap('2026-09-14T20:00:00.000Z', '2026-09-14T20:00:05.000Z'),
    5000,
  );
  assert.equal(computeTemporalGap(null, '2026-09-14T20:00:05.000Z'), null);
});

test('rejects an out-of-order observation sequence', () => {
  assert.throws(
    () => computeTemporalGap('2026-09-14T20:00:05.000Z', '2026-09-14T20:00:00.000Z'),
    /SEQUENCE_OUT_OF_ORDER/,
  );
});

test('freshness is deterministic and policy-defined', () => {
  const policy = {
    freshWithinMs: 5_000,
    agingWithinMs: 15_000,
    staleWithinMs: 60_000,
    expiredAfterMs: 300_000,
  };

  assert.equal(
    classifySpatialFreshness('2026-09-14T20:00:00.000Z', '2026-09-14T20:00:05.000Z', policy),
    'FRESH',
  );
  assert.equal(
    classifySpatialFreshness('2026-09-14T20:00:00.000Z', '2026-09-14T20:00:20.000Z', policy),
    'STALE',
  );
  assert.equal(
    classifySpatialFreshness('2026-09-14T20:00:00.000Z', '2026-09-14T20:06:00.000Z', policy),
    'EXPIRED',
  );
});

test('continuity distinguishes normal cadence, degraded cadence, and broken gaps', () => {
  assert.equal(deriveContinuity(1000, 1100, 1000), 'continuous');
  assert.equal(deriveContinuity(1700, null, 1000), 'intermittent');
  assert.equal(deriveContinuity(4000, null, 1000), 'broken');
  assert.equal(deriveContinuity(null, null, 1000), 'unknown');
});

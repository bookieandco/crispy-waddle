import assert from 'node:assert/strict';
import test from 'node:test';
import { decideMining, expectedNetPerHour, type PolicyLimits, type Resource, type WorkloadEstimate } from '../src/index.ts';

const resource: Resource = {
  resourceId: 'miner-001',
  kind: 'asic',
  authorization: 'execute',
  powerLimitWatts: 3000,
};

const limits: PolicyLimits = {
  minimumNetPerHour: 0,
  maxPowerWatts: 3500,
  minConfidence: 0.8,
};

const profitable: WorkloadEstimate = {
  workloadId: 'btc',
  kind: 'bitcoin-mining',
  revenuePerHour: 1.25,
  electricityCostPerHour: 0.45,
  providerFeesPerHour: 0.10,
  confidence: 0.95,
};

test('calculates expected net per hour', () => {
  assert.ok(Math.abs(expectedNetPerHour(profitable) - 0.7) < Number.EPSILON);
});

test('starts an authorized profitable Bitcoin workload', () => {
  assert.equal(decideMining(resource, profitable, limits).decision, 'start');
});

test('denies an unauthorized resource', () => {
  assert.equal(decideMining({ ...resource, authorization: 'disabled' }, profitable, limits).decision, 'deny');
});

test('observes when confidence is too low', () => {
  assert.equal(decideMining(resource, { ...profitable, confidence: 0.5 }, limits).decision, 'observe');
});

test('stops when expected net is below the configured floor', () => {
  assert.equal(decideMining(resource, { ...profitable, revenuePerHour: 0.2 }, limits).decision, 'stop');
});

test('denies a workload that is not Bitcoin mining', () => {
  assert.equal(decideMining(resource, { ...profitable, kind: 'ai-compute' }, limits).decision, 'deny');
});

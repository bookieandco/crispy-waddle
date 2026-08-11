import assert from 'node:assert/strict';
import test from 'node:test';
import { planCpuminerDryRun } from '../src/cpuminer.ts';
import type { OpportunityDecision, Resource, WorkloadEstimate } from '../src/index.ts';

const resource: Resource = {
  resourceId: 'cpu-001',
  kind: 'cpu',
  authorization: 'execute',
  powerLimitWatts: 65,
};

const estimate: WorkloadEstimate = {
  workloadId: 'btc-cpu',
  kind: 'bitcoin-mining',
  revenuePerHour: 1,
  electricityCostPerHour: 0.1,
  providerFeesPerHour: 0.1,
  confidence: 0.95,
};

const start: OpportunityDecision = {
  decision: 'start',
  expectedNetPerHour: 0.8,
  reasonCodes: [],
};

const config = {
  executable: 'cpuminer',
  algorithm: 'sha256d' as const,
  poolUrl: 'stratum+tcp://pool.example:3333',
  workerName: 'jhadina-worker',
  threads: 2,
};

test('creates a dry-run cpuminer command without spawning it', () => {
  const plan = planCpuminerDryRun(resource, estimate, start, config);
  assert.equal(plan.mode, 'dry-run');
  assert.equal(plan.command, 'cpuminer');
  assert.deepEqual(plan.args, [
    '-a', 'sha256d',
    '-o', 'stratum+tcp://pool.example:3333',
    '-u', 'jhadina-worker',
    '-t', '2',
  ]);
});

test('does not produce execution arguments when policy denies', () => {
  const denied = { ...start, decision: 'deny' as const };
  const plan = planCpuminerDryRun(resource, estimate, denied, config);
  assert.deepEqual(plan.args, []);
});

test('rejects invalid thread counts', () => {
  assert.throws(
    () => planCpuminerDryRun(resource, estimate, start, { ...config, threads: 0 }),
    /INVALID_THREAD_COUNT/,
  );
});

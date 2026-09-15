import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSpatialReadiness } from './spatial-pipeline.js';

test('SPATIAL-16 fails closed on unknown or failed gates and never declares production ready', () => {
  const report = evaluateSpatialReadiness([
    { id: 'fusion', result: 'PASS', rationale: 'deterministic fusion checks present' },
    { id: 'privacy', result: 'UNKNOWN', rationale: 'provider integration still requires verification' },
  ]);
  assert.equal(report.architectureComplete, false);
  assert.equal(report.implementationComplete, false);
  assert.equal(report.productionReady, false);
});

test('SPATIAL-16 can certify the contract layer while keeping production readiness explicit', () => {
  const report = evaluateSpatialReadiness([
    { id: 'fusion', result: 'PASS', rationale: 'pass' },
    { id: 'query', result: 'PASS', rationale: 'pass' },
  ]);
  assert.equal(report.architectureComplete, true);
  assert.equal(report.implementationComplete, true);
  assert.equal(report.productionReady, false);
});

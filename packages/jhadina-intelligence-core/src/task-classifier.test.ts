import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicTaskClassifier } from './task-classifier.js';

const classifier = new DeterministicTaskClassifier();

test('classifies research without granting action authority', () => {
  const task = classifier.classify({ id: 't1', purpose: 'Research current evidence and compare sources' });
  assert.equal(task.kind, 'research');
  assert.deepEqual(task.requiredCapabilities, ['research', 'reason', 'verify', 'summarize']);
  assert.equal('approved' in task, false);
  assert.equal('execute' in task, false);
});

test('coding requires code modality and cognitive capabilities only', () => {
  const task = classifier.classify({ id: 't2', purpose: 'Debug this TypeScript API and test the fix' });
  assert.equal(task.kind, 'coding');
  assert.deepEqual(task.modalities, ['text', 'code']);
  assert.ok(task.requiredCapabilities.includes('verify'));
});

test('review outranks generic planning signals for audits', () => {
  const task = classifier.classify({ id: 't3', purpose: 'Audit and reconcile this architecture, then plan repairs' });
  assert.equal(task.kind, 'review');
  assert.ok(task.requiredCapabilities.includes('critique'));
});

test('trusted hint is advisory taxonomy, while risk and privacy remain caller supplied', () => {
  const task = classifier.classify({
    id: 't4', purpose: 'Continue', taskKindHint: 'planning',
    riskClass: 'high', privacyClass: 'restricted',
  });
  assert.equal(task.kind, 'planning');
  assert.equal(task.riskClass, 'high');
  assert.equal(task.privacyClass, 'restricted');
});

test('complex multi-modal work escalates complexity deterministically', () => {
  const task = classifier.classify({
    id: 't5',
    purpose: 'Deep multi-step architecture review with adversarial cross-check and reconciliation',
    modalities: ['text', 'vision', 'audio'],
  });
  assert.equal(task.complexity, 'deep');
});

test('empty purpose fails closed', () => {
  assert.throws(() => classifier.classify({ id: 't6', purpose: '   ' }), /INTELLIGENCE_TASK_PURPOSE_REQUIRED/);
});

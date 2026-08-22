import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCapability, JHADINA_CAPABILITY_CLASSIFICATIONS } from './capability-classification.js';

test('every classified capability has at least one category and a description', () => {
  for (const entry of JHADINA_CAPABILITY_CLASSIFICATIONS) {
    assert.ok(entry.categories.length > 0, `${entry.capability} has no category`);
    assert.ok(entry.description.length > 0, `${entry.capability} has no description`);
  }
});

test('an unclassified capability returns undefined, not a guessed classification', () => {
  assert.equal(classifyCapability('totally.made.up.capability'), undefined);
});

test('classifies money.account.read as read_only, not financial (it never moves money)', () => {
  const entry = classifyCapability('money.account.read');
  assert.ok(entry?.categories.includes('read_only'));
  assert.equal(entry?.categories.includes('financial'), false);
});

test('classifies money-moving capabilities as financial', () => {
  for (const capability of ['money.transfer.create', 'financial.execute', 'commerce.payment.charge']) {
    const entry = classifyCapability(capability);
    assert.ok(entry?.categories.includes('financial'), `${capability} should be financial`);
  }
});

test('classifies policy.self_modify as both code_evolution and destructive', () => {
  const entry = classifyCapability('policy.self_modify');
  assert.ok(entry?.categories.includes('code_evolution'));
  assert.ok(entry?.categories.includes('destructive'));
});

test('classifies memory.propose as read_only (proposing is not committing)', () => {
  const entry = classifyCapability('memory.propose');
  assert.ok(entry?.categories.includes('read_only'));
});

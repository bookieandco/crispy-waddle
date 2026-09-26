import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialReferenceProvenanceRegistry,
  INITIAL_REFERENCE_IDS,
} from './seed-registry.js';
import { MONEY_TRADING_FOUNDATION_REFERENCE_IDS } from './money-trading-foundation-reference-seed.js';

test('user-supplied trading foundation source is durable but has no runtime authority', () => {
  const registry = createInitialReferenceProvenanceRegistry();

  for (const referenceId of MONEY_TRADING_FOUNDATION_REFERENCE_IDS) {
    assert.ok(INITIAL_REFERENCE_IDS.includes(referenceId));
    const reference = registry.getReference(referenceId);
    assert.ok(reference);
    assert.equal(reference.discoveredFrom, 'USER');
    assert.equal(reference.traceabilityStatus, 'HANDOFF_ONLY');
    assert.equal(reference.licenseStatus, 'UNKNOWN');
    assert.equal(reference.authority.runtimeAuthority, 'NONE');
    assert.equal(reference.authority.executionAuthority, 'NONE');
    assert.equal(reference.authority.factualAuthority, 'NONE');
  }
});

test('trading foundation concepts are adapted into readiness and vehicle semantics rather than copied as trading authority', () => {
  const registry = createInitialReferenceProvenanceRegistry();
  const mapping = registry.getMapping(
    'map:money:trader-readiness-foundations',
  );

  assert.ok(mapping);
  assert.equal(mapping.adoptionStatus, 'ADAPTED');
  assert.ok(
    mapping.borrowedConcepts.includes(
      'paper-first learning before real-money trading',
    ),
  );
  assert.ok(
    mapping.adaptationNotes.includes(
      'paper profit alone is insufficient',
    ),
  );
  assert.ok(
    mapping.adaptationNotes.includes(
      'strategy edge requires independent target-market validation',
    ),
  );
  assert.equal(mapping.authority.executionAuthority, 'NONE');
});

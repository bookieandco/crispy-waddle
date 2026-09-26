import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialReferenceProvenanceRegistry,
  INITIAL_REFERENCE_IDS,
} from './seed-registry.js';
import { MONEY_BEHAVIORAL_RISK_REFERENCE_IDS } from './money-behavioral-risk-reference-seed.js';

test('trading psychology marketing source is durable context with zero authority', () => {
  const registry = createInitialReferenceProvenanceRegistry();

  for (const referenceId of MONEY_BEHAVIORAL_RISK_REFERENCE_IDS) {
    assert.ok(INITIAL_REFERENCE_IDS.includes(referenceId));

    const reference = registry.getReference(referenceId);
    assert.ok(reference);
    assert.equal(reference.discoveredFrom, 'USER');
    assert.equal(reference.traceabilityStatus, 'HANDOFF_ONLY');
    assert.equal(reference.licenseStatus, 'UNKNOWN');
    assert.equal(reference.authority.runtimeAuthority, 'NONE');
    assert.equal(reference.authority.policyAuthority, 'NONE');
    assert.equal(reference.authority.executionAuthority, 'NONE');
    assert.equal(reference.authority.factualAuthority, 'NONE');
  }
});

test('behavioral-risk mapping adapts discipline concepts without inferring psychology or trusting return claims', () => {
  const registry = createInitialReferenceProvenanceRegistry();
  const mapping = registry.getMapping(
    'map:money:behavioral-risk-process-consistency',
  );

  assert.ok(mapping);
  assert.equal(mapping.adoptionStatus, 'ADAPTED');
  assert.ok(
    mapping.borrowedConcepts.includes(
      'revenge-trade and loss-chasing as observable risk-escalation patterns',
    ),
  );
  assert.ok(
    mapping.adaptationNotes.includes(
      'does not infer private mental state',
    ),
  );
  assert.ok(
    mapping.adaptationNotes.includes(
      'Martingale and recent-PnL-driven risk escalation remain forbidden',
    ),
  );
  assert.equal(mapping.authority.executionAuthority, 'NONE');
});

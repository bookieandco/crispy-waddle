import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialReferenceProvenanceRegistry,
  INITIAL_REFERENCE_IDS,
} from './seed-registry.js';
import { MONEY_AUTOMATION_ECON_REFERENCE_IDS } from './money-automation-economics-reference-seed.js';

test('EA automation transcript is durable source context with zero authority', () => {
  const registry = createInitialReferenceProvenanceRegistry();

  for (const referenceId of MONEY_AUTOMATION_ECON_REFERENCE_IDS) {
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

test('automation economics mapping adapts claims into measurable research gates', () => {
  const registry = createInitialReferenceProvenanceRegistry();
  const mapping = registry.getMapping(
    'map:money:automation-economics-claims',
  );

  assert.ok(mapping);
  assert.equal(mapping.adoptionStatus, 'ADAPTED');
  assert.ok(
    mapping.borrowedConcepts.includes(
      'capital-size sensitivity to fixed and variable execution costs',
    ),
  );
  assert.ok(
    mapping.adaptationNotes.includes(
      'does not adopt the source-specific $500 minimum',
    ),
  );
  assert.ok(
    mapping.adaptationNotes.includes(
      'Broker compatibility is evidence-based',
    ),
  );
  assert.equal(mapping.authority.executionAuthority, 'NONE');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialReferenceProvenanceRegistry,
  INITIAL_REFERENCE_IDS,
} from './seed-registry.js';
import { MONEY_INSTITUTIONAL_FLOW_REFERENCE_IDS } from './money-institutional-flow-reference-seed.js';

test('institutional-flow marketing transcript is durable source context with zero authority', () => {
  const registry = createInitialReferenceProvenanceRegistry();

  for (const referenceId of MONEY_INSTITUTIONAL_FLOW_REFERENCE_IDS) {
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

test('institutional-flow mapping adapts the idea without trusting named-bank marketing claims', () => {
  const registry = createInitialReferenceProvenanceRegistry();
  const mapping = registry.getMapping(
    'map:money:institutional-flow-provenance',
  );

  assert.ok(mapping);
  assert.equal(mapping.adoptionStatus, 'ADAPTED');
  assert.ok(
    mapping.borrowedConcepts.includes(
      'institutional positioning as a distinct FX intelligence channel',
    ),
  );
  assert.ok(
    mapping.adaptationNotes.includes(
      'Named institutional identities are accepted only from direct participant-classified evidence',
    ),
  );
  assert.ok(
    mapping.adaptationNotes.includes(
      'Vendor assertions cannot create learnable examples',
    ),
  );
  assert.equal(mapping.authority.executionAuthority, 'NONE');
});

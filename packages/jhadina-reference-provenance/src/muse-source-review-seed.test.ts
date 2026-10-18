import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialReferenceProvenanceRegistry, INITIAL_REFERENCE_IDS } from './seed-registry.js';
import { NO_REFERENCE_AUTHORITY } from './index.js';

test('unverified Muse Spark repo is explicitly rejected as runtime/provider authority', () => {
  const registry = createInitialReferenceProvenanceRegistry();
  const entry = registry.getReference('github:muse-spark-app/muse-spark');
  assert.ok(entry);
  assert.equal(entry.traceabilityStatus, 'REJECTED');
  assert.deepEqual(entry.authority, NO_REFERENCE_AUTHORITY);
  assert.match(entry.notes ?? '', /NOT downloaded, executed/);
  assert.ok(INITIAL_REFERENCE_IDS.includes(entry.referenceId));
  assert.equal(registry.mappingsForReference(entry.referenceId).length, 0);
});

test('official Meta documentation does not authorize a model call', () => {
  const registry = createInitialReferenceProvenanceRegistry();
  const official = registry.getReference('website:meta-official-muse-spark-api');
  assert.ok(official);
  assert.equal(official.traceabilityStatus, 'EXTERNALLY_VERIFIED');
  assert.equal(official.licenseStatus, 'UNKNOWN');
  assert.equal(official.authority.executionAuthority, 'NONE');
  assert.equal(official.authority.factualAuthority, 'NONE');
  registry.assertIntegrity();
});

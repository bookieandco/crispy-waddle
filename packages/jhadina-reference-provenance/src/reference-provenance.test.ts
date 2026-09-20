import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NO_REFERENCE_AUTHORITY,
  ReferenceProvenanceRegistry,
  buildReferenceRecord,
} from './index.js';
import {
  INITIAL_REFERENCE_IDS,
  createInitialReferenceProvenanceRegistry,
} from './seed-registry.js';

function tracedReference() {
  return {
    referenceId: 'github:example/project',
    canonicalName: 'Example Project',
    kind: 'GITHUB_REPOSITORY' as const,
    roles: ['ALGORITHM_REFERENCE'] as const,
    canonicalLocator: 'https://github.com/example/project',
    discoveredFrom: 'REPOSITORY' as const,
    traceabilityStatus: 'REPO_TRACEABLE' as const,
    licenseStatus: 'UNKNOWN' as const,
    evidence: [
      {
        evidenceId: 'repo:example',
        kind: 'REPO_PATH' as const,
        locator: 'repo:docs/example.md',
      },
    ],
  };
}

test('reference records are deterministic and carry no runtime authority', () => {
  const first = buildReferenceRecord(tracedReference());
  const second = buildReferenceRecord({
    ...tracedReference(),
    roles: ['ALGORITHM_REFERENCE'],
  });

  assert.equal(first.recordHash, second.recordHash);
  assert.deepEqual(first.authority, NO_REFERENCE_AUTHORITY);
  assert.equal(first.authority.executionAuthority, 'NONE');
  assert.equal(first.authority.factualAuthority, 'NONE');
});

test('repo-traceable status requires repository evidence', () => {
  assert.throws(
    () =>
      buildReferenceRecord({
        ...tracedReference(),
        evidence: [
          {
            evidenceId: 'handoff-only',
            kind: 'HANDOFF_NOTE',
            locator: 'urn:jhadina:handoff:example',
          },
        ],
      }),
    /REPO_TRACEABILITY_EVIDENCE_REQUIRED/,
  );
});

test('verified license claims require license evidence', () => {
  assert.throws(
    () =>
      buildReferenceRecord({
        ...tracedReference(),
        licenseStatus: 'VERIFIED',
        licenseExpression: 'MIT',
      }),
    /VERIFIED_LICENSE_EVIDENCE_REQUIRED/,
  );
});

test('handoff-only references cannot be promoted directly to IMPLEMENTED', () => {
  const registry = new ReferenceProvenanceRegistry();
  registry.registerReference({
    ...tracedReference(),
    referenceId: 'github:example/handoff-only',
    canonicalLocator: 'https://github.com/example/handoff-only',
    traceabilityStatus: 'HANDOFF_ONLY',
    discoveredFrom: 'HANDOFF',
    evidence: [
      {
        evidenceId: 'handoff:example',
        kind: 'HANDOFF_NOTE',
        locator: 'urn:jhadina:handoff:example',
      },
    ],
  });

  assert.throws(
    () =>
      registry.registerMapping({
        mappingId: 'map:example:implemented',
        referenceId: 'github:example/handoff-only',
        subsystem: 'Example',
        targetPaths: ['packages/example/src/index.ts'],
        borrowedArtifactKinds: ['IDEA_ONLY'],
        borrowedConcepts: ['example concept'],
        adaptationNotes: 'Test mapping.',
        adoptionStatus: 'IMPLEMENTED',
        implementationEvidence: [
          {
            evidenceId: 'repo:example:implementation',
            kind: 'REPO_PATH',
            locator: 'repo:packages/example/src/index.ts',
          },
        ],
      }),
    /IMPLEMENTED_REFERENCE_NOT_VERIFIED/,
  );
});

test('code derivation requires verified license status', () => {
  const registry = new ReferenceProvenanceRegistry();
  registry.registerReference(tracedReference());

  assert.throws(
    () =>
      registry.registerMapping({
        mappingId: 'map:example:code',
        referenceId: 'github:example/project',
        subsystem: 'Example',
        targetPaths: ['packages/example/src/index.ts'],
        borrowedArtifactKinds: ['CODE'],
        borrowedConcepts: ['copied helper'],
        adaptationNotes: 'Would be code derivation.',
        adoptionStatus: 'IMPLEMENTED',
        implementationEvidence: [
          {
            evidenceId: 'repo:example:implementation',
            kind: 'REPO_PATH',
            locator: 'repo:packages/example/src/index.ts',
          },
        ],
      }),
    /CODE_DERIVATION_LICENSE_NOT_VERIFIED/,
  );
});

test('implemented mapping requires repository implementation evidence', () => {
  const registry = new ReferenceProvenanceRegistry();
  registry.registerReference(tracedReference());

  assert.throws(
    () =>
      registry.registerMapping({
        mappingId: 'map:example:no-repo-proof',
        referenceId: 'github:example/project',
        subsystem: 'Example',
        targetPaths: ['packages/example/src/index.ts'],
        borrowedArtifactKinds: ['IDEA_ONLY'],
        borrowedConcepts: ['example idea'],
        adaptationNotes: 'Missing repository proof.',
        adoptionStatus: 'IMPLEMENTED',
        implementationEvidence: [
          {
            evidenceId: 'url:example',
            kind: 'URL',
            locator: 'https://example.com/evidence',
          },
        ],
      }),
    /IMPLEMENTATION_REPO_EVIDENCE_REQUIRED/,
  );
});

test('registry prevents orphan mappings and supersession cycles', () => {
  const registry = new ReferenceProvenanceRegistry();
  assert.throws(
    () =>
      registry.registerMapping({
        mappingId: 'map:orphan',
        referenceId: 'github:missing/project',
        subsystem: 'Example',
        targetPaths: ['packages/example/src/index.ts'],
        borrowedArtifactKinds: ['IDEA_ONLY'],
        borrowedConcepts: ['idea'],
        adaptationNotes: 'Orphan test.',
        adoptionStatus: 'DISCOVERED',
        implementationEvidence: [
          {
            evidenceId: 'repo:test',
            kind: 'REPO_PATH',
            locator: 'repo:packages/example/src/index.ts',
          },
        ],
      }),
    /REFERENCE_NOT_REGISTERED/,
  );

  const cyclic = new ReferenceProvenanceRegistry();
  cyclic.registerReference({
    ...tracedReference(),
    referenceId: 'github:example/a',
    canonicalLocator: 'https://github.com/example/a',
    traceabilityStatus: 'SUPERSEDED',
    supersededByReferenceId: 'github:example/b',
  });
  cyclic.registerReference({
    ...tracedReference(),
    referenceId: 'github:example/b',
    canonicalLocator: 'https://github.com/example/b',
    traceabilityStatus: 'SUPERSEDED',
    supersededByReferenceId: 'github:example/a',
  });
  assert.throws(
    () => cyclic.assertIntegrity(),
    /SUPERSESSION_CYCLE/,
  );
});

test('initial registry separates traceable implementation from handoff debt', () => {
  const registry = createInitialReferenceProvenanceRegistry();
  const unresolved = registry.unresolvedReferences();

  assert.ok(INITIAL_REFERENCE_IDS.length >= 10);
  assert.ok(
    unresolved.some(
      (record) =>
        record.referenceId ===
        'github:maariia-saez/MDP-Adaptive-GA',
    ),
  );

  const dex = registry.getReference('api:dexscreener');
  assert.equal(dex?.traceabilityStatus, 'REPO_TRACEABLE');

  const dexMappings = registry.mappingsForReference(
    'api:dexscreener',
  );
  assert.equal(dexMappings.length, 1);
  assert.equal(dexMappings[0]?.adoptionStatus, 'IMPLEMENTED');
});

test('snapshot hash changes when registry content changes', () => {
  const registry = createInitialReferenceProvenanceRegistry();
  const before = registry.snapshot('2026-09-20T03:50:00Z');

  registry.registerReference({
    ...tracedReference(),
    referenceId: 'github:example/new',
    canonicalLocator: 'https://github.com/example/new',
  });

  const after = registry.snapshot('2026-09-20T03:51:00Z');
  assert.notEqual(before.registryHash, after.registryHash);
  assert.equal(after.authority.runtimeAuthority, 'NONE');
});

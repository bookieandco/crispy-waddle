import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReferenceCoverageReport,
  DEFAULT_REFERENCE_SUBSYSTEM_HINTS,
} from './coverage.js';
import { createInitialReferenceProvenanceRegistry } from './seed-registry.js';

test('repository-wide inventory captures implemented provider boundaries', () => {
  const registry = createInitialReferenceProvenanceRegistry();

  for (const referenceId of [
    'api:plaid',
    'api:stripe',
    'api:anthropic',
    'api:shodan',
    'api:coingecko-pro',
    'api:helius',
    'api:sam-gov',
    'provider:reticulum',
    'provider:comfyui',
    'provider:supabase',
    'model:sam2',
  ]) {
    assert.ok(
      registry.getReference(referenceId),
      `missing ${referenceId}`,
    );
  }

  assert.equal(
    registry.getMapping('map:money:plaid-readonly')
      ?.adoptionStatus,
    'IMPLEMENTED',
  );
  assert.equal(
    registry.getMapping('map:director:sam2-tracking')
      ?.adoptionStatus,
    'ADAPTED',
  );
});

test('music references remain bounded design mappings instead of code claims', () => {
  const registry = createInitialReferenceProvenanceRegistry();

  for (const mappingId of [
    'map:music:voicefixer',
    'map:music:neuralnote',
    'map:music:chow-tape',
    'map:music:dawdreamer',
    'map:music:ace-step',
    'map:music:musescore',
  ]) {
    const mapping = registry.getMapping(mappingId);
    assert.ok(mapping);
    assert.equal(
      mapping?.borrowedArtifactKinds.includes('CODE'),
      false,
    );
    assert.notEqual(mapping?.adoptionStatus, 'IMPLEMENTED');
  }
});

test('justice source catalog stays non-live and non-authoritative', () => {
  const registry = createInitialReferenceProvenanceRegistry();

  for (const referenceId of [
    'justice:statedecoded',
    'justice:citation-regexes',
    'justice:statedb',
  ]) {
    const reference = registry.getReference(referenceId);
    assert.equal(
      reference?.traceabilityStatus,
      'REPO_TRACEABLE',
    );
    assert.equal(reference?.authority.factualAuthority, 'NONE');
  }
});

test('coverage report keeps handoff debt assigned without inventing mappings', () => {
  const registry = createInitialReferenceProvenanceRegistry();
  const report = buildReferenceCoverageReport(registry);

  const sports = report.subsystemCoverage.find(
    (row) => row.subsystem === 'Sports',
  );
  assert.equal(sports?.status, 'DISCOVERY_REQUIRED');
  assert.ok(
    sports?.unresolvedReferenceIds.includes(
      'github:maariia-saez/MDP-Adaptive-GA',
    ),
  );

  const shark = report.subsystemCoverage.find(
    (row) => row.subsystem === 'SHARK',
  );
  assert.ok(
    shark?.implementedMappingIds.includes(
      'map:shark:dexscreener-ingest',
    ),
  );
  assert.ok(
    shark?.unresolvedReferenceIds.includes(
      'github:keidev-sol/Meteora-Rug-Bot',
    ),
  );
  assert.equal(shark?.status, 'PARTIAL');
});

test('fully traceable API-only subsystem can be TRACEABLE', () => {
  const registry = createInitialReferenceProvenanceRegistry();
  const report = buildReferenceCoverageReport(registry);
  const commerce = report.subsystemCoverage.find(
    (row) => row.subsystem === 'Commerce',
  );

  assert.equal(commerce?.status, 'TRACEABLE');
  assert.equal(commerce?.coverageRatio, 1);
  assert.deepEqual(commerce?.unresolvedReferenceIds, []);
});

test('unknown-license design references remain visible coverage debt', () => {
  const registry = createInitialReferenceProvenanceRegistry();
  const report = buildReferenceCoverageReport(registry);

  const music = report.subsystemCoverage.find(
    (row) => row.subsystem === 'Music',
  );
  assert.equal(music?.status, 'PARTIAL');
  assert.ok((music?.unknownLicenseReferenceIds.length ?? 0) >= 8);
});

test('coverage hints fail closed when they name a nonexistent reference', () => {
  const registry = createInitialReferenceProvenanceRegistry();

  assert.throws(
    () =>
      buildReferenceCoverageReport(registry, [
        ...DEFAULT_REFERENCE_SUBSYSTEM_HINTS,
        {
          referenceId: 'missing:reference',
          subsystem: 'Missing',
          rationale: 'Must fail.',
        },
      ]),
    /HINT_UNKNOWN_REFERENCE/,
  );
});

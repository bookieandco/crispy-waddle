import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertProviderContractCompatible,
  buildProviderContractSnapshot,
  buildReferenceArtifactPin,
  providerContractShapeDigest,
  verifyArtifactBytes,
} from './index.js';
import {
  buildProviderArtifactCoverageReport,
} from './provider-artifact-report.js';
import {
  createInitialReferenceProvenanceRegistry,
} from './seed-registry.js';

test('provider contract digest is deterministic and field-order insensitive', () => {
  const shape = {
    providerId: 'example',
    protocol: 'HTTP' as const,
    baseLocator: 'https://api.example.com/',
    versionStrategy: 'PATH' as const,
    versionValue: 'v1',
    endpoints: [
      {
        operationId: 'read',
        method: 'GET' as const,
        pathTemplate: '/v1/read',
        requiredRequestHeaders: ['x-b', 'x-a'],
        requiredRequestFields: ['b', 'a'],
        requiredResponseFields: ['result'],
      },
    ],
  };

  const reordered = {
    ...shape,
    baseLocator: 'https://api.example.com',
    endpoints: [
      {
        ...shape.endpoints[0]!,
        requiredRequestHeaders: ['x-a', 'x-b'],
        requiredRequestFields: ['a', 'b'],
      },
    ],
  };

  assert.equal(
    providerContractShapeDigest(shape),
    providerContractShapeDigest(reordered),
  );
});

test('provider contract compatibility fails on version drift', () => {
  const expected = buildProviderContractSnapshot({
    contractId: 'contract:example:v1',
    referenceId: 'api:example',
    providerId: 'example',
    protocol: 'HTTP',
    baseLocator: 'https://api.example.com',
    versionStrategy: 'PATH',
    versionValue: 'v1',
    endpoints: [
      {
        operationId: 'read',
        method: 'GET',
        pathTemplate: '/v1/read',
        requiredRequestHeaders: [],
        requiredRequestFields: [],
        requiredResponseFields: ['result'],
      },
    ],
    verifiedAt: '2026-09-20T04:20:00Z',
    evidence: [
      {
        evidenceId: 'repo:example-contract',
        kind: 'REPO_PATH',
        locator: 'repo:packages/example/provider.ts',
      },
    ],
  });

  assert.doesNotThrow(() =>
    assertProviderContractCompatible(expected, {
      providerId: 'example',
      protocol: 'HTTP',
      baseLocator: 'https://api.example.com',
      versionStrategy: 'PATH',
      versionValue: 'v1',
      endpoints: expected.endpoints,
    }),
  );

  assert.throws(
    () =>
      assertProviderContractCompatible(expected, {
        providerId: 'example',
        protocol: 'HTTP',
        baseLocator: 'https://api.example.com',
        versionStrategy: 'PATH',
        versionValue: 'v2',
        endpoints: expected.endpoints,
      }),
    /PROVIDER_CONTRACT_DRIFT/,
  );
});

test('pinned artifacts verify SHA-256 bytes and length', () => {
  const bytes = new TextEncoder().encode('artifact-fixture');
  const pin = buildReferenceArtifactPin({
    pinId: 'artifact:example:fixture',
    referenceId: 'api:example',
    artifactId: 'example:fixture',
    artifactKind: 'OTHER',
    status: 'PINNED',
    locator: 'urn:artifact:example:fixture',
    digestAlgorithm: 'SHA256',
    digest:
      'sha256:fef393cca2055f043b228a2ee7719db4ca9199a9d9bc28f7affadc684011db94',
    byteLength: bytes.byteLength,
    verifiedAt: '2026-09-20T04:20:00Z',
    evidence: [
      {
        evidenceId: 'repo:example-artifact',
        kind: 'REPO_PATH',
        locator: 'repo:fixtures/artifact-fixture',
      },
    ],
  });

  assert.doesNotThrow(() => verifyArtifactBytes(pin, bytes));
  assert.throws(
    () =>
      verifyArtifactBytes(
        pin,
        new TextEncoder().encode('different'),
      ),
    /ARTIFACT_DIGEST_MISMATCH/,
  );
});

test('unresolved artifact cannot pretend to have a digest', () => {
  assert.throws(
    () =>
      buildReferenceArtifactPin({
        pinId: 'artifact:unresolved',
        referenceId: 'api:example',
        artifactId: 'unresolved',
        artifactKind: 'MODEL_WEIGHTS',
        status: 'REQUIRED_UNRESOLVED',
        locator: 'urn:artifact:unresolved',
        digestAlgorithm: 'SHA256',
        digest:
          'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        evidence: [
          {
            evidenceId: 'repo:unresolved',
            kind: 'REPO_PATH',
            locator: 'repo:docs/unresolved.md',
          },
        ],
      }),
    /UNRESOLVED_ARTIFACT_CANNOT_CLAIM_DIGEST/,
  );
});

test('REF-PROV-04 closes live provider contract coverage without inventing model hashes', () => {
  const registry = createInitialReferenceProvenanceRegistry();
  const report = buildProviderArtifactCoverageReport(registry);

  assert.equal(report.uncontractedProviderReferenceIds.length, 0);
  assert.ok(report.totalProviderReferences >= 11);
  assert.ok(report.totalProviderContracts >= 12);

  for (const contractId of [
    'contract:plaid:accounts-get:2020-09-14',
    'contract:stripe:payments:2026-08-26.dahlia',
    'contract:anthropic:messages:2023-06-01',
    'contract:dexscreener:token-pairs:v1',
    'contract:coingecko:onchain:v3',
    'contract:helius:get-transfers:jsonrpc-2.0',
    'contract:sam-gov:opportunities:v2',
    'contract:comfyui:http:c8ed2c8c',
    'contract:reticulum:bridge:99de23c0',
    'contract:supabase:runtime:js-2.116.0',
  ]) {
    assert.ok(registry.getProviderContract(contractId));
  }

  assert.ok(
    report.unresolvedArtifactPinIds.includes(
      'artifact:sam2:checkpoint',
    ),
  );
  assert.equal(report.pinnedArtifactPinIds.length, 0);
});

test('registry snapshot includes contract and artifact identities', () => {
  const registry = createInitialReferenceProvenanceRegistry();
  const snapshot = registry.snapshot('2026-09-20T04:25:00Z');

  assert.ok(snapshot.providerContractIds.length >= 12);
  assert.ok(snapshot.artifactPinIds.length >= 5);
  assert.equal(snapshot.authority.executionAuthority, 'NONE');
});

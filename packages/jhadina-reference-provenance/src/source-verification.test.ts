import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ReferenceSourceVerificationRegistry,
  buildReferenceSourceVerification,
} from './source-verification.js';
import {
  createInitialSourceVerificationRegistry,
  INITIAL_SOURCE_VERIFICATIONS,
} from './source-verification-seed.js';
import { createInitialReferenceProvenanceRegistry } from './seed-registry.js';
import { buildReferenceCoverageReport } from './coverage.js';

test('git source verification requires immutable commit digest', () => {
  assert.throws(
    () =>
      buildReferenceSourceVerification({
        verificationId: 'v:bad',
        referenceId: 'github:example/project',
        status: 'VERIFIED',
        sourceKind: 'GIT_REPOSITORY',
        upstreamLocator: 'https://github.com/example/project',
        revision: {
          kind: 'GIT_COMMIT',
          value: '0123456789012345678901234567890123456789',
          defaultBranch: 'main',
        },
        sourceDigest:
          'git-commit:ffffffffffffffffffffffffffffffffffffffff',
        license: { status: 'UNKNOWN' },
        verifiedAt: '2026-09-20T04:00:00Z',
        evidence: [
          {
            evidenceId: 'repo',
            kind: 'UPSTREAM_REPOSITORY',
            locator: 'https://github.com/example/project',
          },
        ],
      }),
    /GIT_DIGEST_MISMATCH/,
  );
});

test('verified license evidence must be pinned to the same revision', () => {
  assert.throws(
    () =>
      buildReferenceSourceVerification({
        verificationId: 'v:license',
        referenceId: 'github:example/project',
        status: 'VERIFIED',
        sourceKind: 'GIT_REPOSITORY',
        upstreamLocator: 'https://github.com/example/project',
        revision: {
          kind: 'GIT_COMMIT',
          value: '0123456789012345678901234567890123456789',
        },
        sourceDigest:
          'git-commit:0123456789012345678901234567890123456789',
        license: {
          status: 'VERIFIED',
          expression: 'MIT',
          evidenceLocator:
            'https://github.com/example/project/blob/main/LICENSE',
        },
        verifiedAt: '2026-09-20T04:00:00Z',
        evidence: [
          {
            evidenceId: 'repo',
            kind: 'UPSTREAM_REPOSITORY',
            locator: 'https://github.com/example/project',
          },
        ],
      }),
    /LICENSE_NOT_REVISION_PINNED/,
  );
});

test('initial verification catalog pins exact upstream revisions', () => {
  const references = createInitialReferenceProvenanceRegistry();
  const sources = createInitialSourceVerificationRegistry(references);

  const comfy = sources.get('provider:comfyui');
  assert.equal(
    comfy?.upstreamLocator,
    'https://github.com/Comfy-Org/ComfyUI',
  );
  assert.equal(
    comfy?.revision?.value,
    'c8ed2c8ce957475459731135c4ca31c6856a4542',
  );
  assert.equal(comfy?.license.status, 'VERIFIED');
  assert.equal(comfy?.license.expression, 'GPL-3.0');
  assert.equal(
    comfy?.sourceDigest,
    'git-commit:c8ed2c8ce957475459731135c4ca31c6856a4542',
  );

  assert.ok(INITIAL_SOURCE_VERIFICATIONS.length >= 20);
});

test('canonical records receive verified license metadata where proven', () => {
  const references = createInitialReferenceProvenanceRegistry();

  const neuralNote = references.getReference(
    'music:neuralnote',
  );
  assert.equal(
    neuralNote?.canonicalLocator,
    'https://github.com/DamRsn/NeuralNote',
  );
  assert.equal(neuralNote?.licenseStatus, 'VERIFIED');
  assert.equal(neuralNote?.licenseExpression, 'Apache-2.0');
  assert.equal(
    neuralNote?.sourceRevision,
    '20ca45ad7b4429dea05a9321020b62bf2ff32fae',
  );

  const ffmpeg = references.getReference(
    'music:ffmpeg-audio-mixer',
  );
  assert.equal(ffmpeg?.licenseStatus, 'UNKNOWN');
  assert.equal(
    ffmpeg?.sourceRevision,
    'f5b66388088b33c8e994be083d31fc48734d629d',
  );
});

test('upstream verification does not upgrade a handoff relationship', () => {
  const references = createInitialReferenceProvenanceRegistry();
  const sources = createInitialSourceVerificationRegistry(references);

  const meteoraReference = references.getReference(
    'github:keidev-sol/Meteora-Rug-Bot',
  );
  const meteoraSource = sources.get(
    'github:keidev-sol/Meteora-Rug-Bot',
  );

  assert.equal(
    meteoraReference?.traceabilityStatus,
    'HANDOFF_ONLY',
  );
  assert.equal(meteoraSource?.status, 'VERIFIED');
  assert.equal(
    references.mappingsForReference(
      'github:keidev-sol/Meteora-Rug-Bot',
    ).length,
    0,
  );

  const report = sources.report();
  assert.ok(
    report.relationshipStillUnverifiedReferenceIds.includes(
      'github:keidev-sol/Meteora-Rug-Bot',
    ),
  );
});

test('Sports remains discovery-required after upstream verification', () => {
  const references = createInitialReferenceProvenanceRegistry();
  const sources = createInitialSourceVerificationRegistry(references);
  const report = buildReferenceCoverageReport(
    references,
    undefined,
    sources,
  );

  const sports = report.subsystemCoverage.find(
    (row) => row.subsystem === 'Sports',
  );
  assert.equal(sports?.status, 'DISCOVERY_REQUIRED');
  assert.equal(sports?.traceableReferenceCount, 0);
  assert.ok(
    sports?.unresolvedReferenceIds.includes(
      'github:maariia-saez/MDP-Adaptive-GA',
    ),
  );
});

test('verified source license clears license debt without clearing relationship debt', () => {
  const references = createInitialReferenceProvenanceRegistry();
  const sources = createInitialSourceVerificationRegistry(references);
  const report = buildReferenceCoverageReport(
    references,
    undefined,
    sources,
  );

  const knowledge = report.subsystemCoverage.find(
    (row) => row.subsystem === 'Knowledge',
  );
  assert.equal(knowledge?.status, 'DISCOVERY_REQUIRED');
  assert.equal(
    knowledge?.unknownLicenseReferenceIds.includes(
      'github:assafelovic/gpt-researcher',
    ),
    false,
  );
  assert.ok(
    knowledge?.unresolvedReferenceIds.includes(
      'github:assafelovic/gpt-researcher',
    ),
  );
});

test('unknown or complex licenses stay explicit', () => {
  const references = createInitialReferenceProvenanceRegistry();
  const sources = createInitialSourceVerificationRegistry(references);

  for (const referenceId of [
    'provider:reticulum',
    'music:musescore',
    'music:ffmpeg-audio-mixer',
    'github:RC-Dynamics/Coach-RL',
    'github:Verified-Intelligence/alpha-beta-CROWN',
    'github:pump-fun/pump-public-docs',
    'github:keidev-sol/Meteora-Rug-Bot',
  ]) {
    assert.equal(
      sources.get(referenceId)?.license.status,
      'UNKNOWN',
      referenceId,
    );
  }
});

test('source verification registry rejects unknown canonical references', () => {
  const references = createInitialReferenceProvenanceRegistry();
  const sources =
    new ReferenceSourceVerificationRegistry(references);

  assert.throws(
    () =>
      sources.register({
        verificationId: 'source:missing',
        referenceId: 'missing:reference',
        status: 'PARTIAL',
        sourceKind: 'OTHER',
        upstreamLocator: 'urn:missing',
        license: { status: 'UNKNOWN' },
        verifiedAt: '2026-09-20T04:00:00Z',
        evidence: [
          {
            evidenceId: 'missing',
            kind: 'OTHER',
            locator: 'urn:missing',
          },
        ],
      }),
    /REFERENCE_NOT_REGISTERED/,
  );
});

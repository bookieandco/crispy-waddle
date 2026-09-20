import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ReferenceProvenanceRegistry,
  buildReferenceSourceVerification,
} from './index.js';
import {
  buildReferenceSourceVerificationReport,
} from './source-verification-report.js';
import {
  createInitialReferenceProvenanceRegistry,
} from './seed-registry.js';

function baseReference(referenceId = 'github:example/permissive') {
  return {
    referenceId,
    canonicalName: 'Example',
    kind: 'GITHUB_REPOSITORY' as const,
    roles: ['ALGORITHM_REFERENCE'] as const,
    canonicalLocator: 'https://github.com/example/permissive',
    discoveredFrom: 'REPOSITORY' as const,
    traceabilityStatus: 'REPO_TRACEABLE' as const,
    licenseStatus: 'UNKNOWN' as const,
    evidence: [
      {
        evidenceId: 'repo:example',
        kind: 'REPO_PATH' as const,
        locator: 'repo:packages/example/src/index.ts',
      },
    ],
  };
}

function verification(
  referenceId: string,
  input?: Partial<Parameters<
    ReferenceProvenanceRegistry['registerSourceVerification']
  >[0]>,
) {
  const sha = '1111111111111111111111111111111111111111';
  return {
    verificationId: `verify:${referenceId}:1`,
    referenceId,
    canonicalSourceLocator:
      'https://github.com/example/permissive',
    sourceVerificationStatus: 'PINNED' as const,
    sourceRevision: sha,
    sourceDigest: `git-commit-sha1:${sha}`,
    verifiedAt: '2026-09-20T04:05:00Z',
    licenseFinding: 'VERIFIED' as const,
    licenseExpression: 'MIT',
    licenseEvidenceLocator:
      `https://raw.githubusercontent.com/example/permissive/${sha}/LICENSE`,
    licenseReusePolicy: 'PERMISSIVE' as const,
    evidence: [
      {
        evidenceId: `commit:${referenceId}:1`,
        kind: 'COMMIT' as const,
        locator:
          `https://github.com/example/permissive/commit/${sha}`,
      },
    ],
    ...input,
  };
}

test('pinned Git verification requires revision, digest and commit evidence', () => {
  const reference = new ReferenceProvenanceRegistry().registerReference(
    baseReference(),
  );

  assert.throws(
    () =>
      buildReferenceSourceVerification(
        {
          ...verification(reference.referenceId),
          sourceDigest: undefined,
        },
        reference,
      ),
    /SOURCE_DIGEST_REQUIRED/,
  );

  assert.throws(
    () =>
      buildReferenceSourceVerification(
        {
          ...verification(reference.referenceId),
          evidence: [
            {
              evidenceId: 'url:only',
              kind: 'URL',
              locator: 'https://github.com/example/permissive',
            },
          ],
        },
        reference,
      ),
    /SOURCE_COMMIT_EVIDENCE_REQUIRED/,
  );
});

test('verified license finding requires evidence and safe reuse class', () => {
  const registry = new ReferenceProvenanceRegistry();
  const reference = registry.registerReference(baseReference());

  assert.throws(
    () =>
      buildReferenceSourceVerification(
        {
          ...verification(reference.referenceId),
          licenseEvidenceLocator: undefined,
        },
        reference,
      ),
    /SOURCE_LICENSE_EVIDENCE_REQUIRED/,
  );

  assert.throws(
    () =>
      buildReferenceSourceVerification(
        {
          ...verification(reference.referenceId),
          licenseReusePolicy: 'NO_LICENSE',
        },
        reference,
      ),
    /SOURCE_LICENSE_POLICY_INVALID/,
  );
});

test('permissive pinned source can satisfy code-reuse license gate', () => {
  const registry = new ReferenceProvenanceRegistry();
  registry.registerReference(baseReference());
  registry.registerSourceVerification(
    verification('github:example/permissive'),
  );

  const mapping = registry.registerMapping({
    mappingId: 'map:example:code',
    referenceId: 'github:example/permissive',
    subsystem: 'Example',
    targetPaths: ['packages/example/src/index.ts'],
    borrowedArtifactKinds: ['CODE'],
    borrowedConcepts: ['licensed helper implementation'],
    adaptationNotes: 'License-gate positive test.',
    adoptionStatus: 'IMPLEMENTED',
    implementationEvidence: [
      {
        evidenceId: 'repo:example:implementation',
        kind: 'REPO_PATH',
        locator: 'repo:packages/example/src/index.ts',
      },
    ],
  });

  assert.equal(mapping.borrowedArtifactKinds[0], 'CODE');
});

test('copyleft or custom license requires explicit reuse review before code derivation', () => {
  const registry = new ReferenceProvenanceRegistry();
  registry.registerReference(baseReference());

  registry.registerSourceVerification(
    verification('github:example/permissive', {
      licenseExpression: 'GPL-3.0',
      licenseReusePolicy: 'COPYLEFT_REVIEW_REQUIRED',
    }),
  );

  assert.throws(
    () =>
      registry.registerMapping({
        mappingId: 'map:example:copyleft-code',
        referenceId: 'github:example/permissive',
        subsystem: 'Example',
        targetPaths: ['packages/example/src/index.ts'],
        borrowedArtifactKinds: ['CODE'],
        borrowedConcepts: ['copyleft implementation'],
        adaptationNotes: 'Must not auto-admit.',
        adoptionStatus: 'IMPLEMENTED',
        implementationEvidence: [
          {
            evidenceId: 'repo:example:implementation',
            kind: 'REPO_PATH',
            locator: 'repo:packages/example/src/index.ts',
          },
        ],
      }),
    /REUSE_REVIEW_REQUIRED/,
  );
});

test('no-license source cannot satisfy code-reuse gate', () => {
  const registry = new ReferenceProvenanceRegistry();
  registry.registerReference(baseReference());

  registry.registerSourceVerification(
    verification('github:example/permissive', {
      licenseFinding: 'NO_LICENSE_FILE',
      licenseExpression: undefined,
      licenseEvidenceLocator: undefined,
      licenseReusePolicy: 'NO_LICENSE',
    }),
  );

  assert.throws(
    () =>
      registry.registerMapping({
        mappingId: 'map:example:no-license-code',
        referenceId: 'github:example/permissive',
        subsystem: 'Example',
        targetPaths: ['packages/example/src/index.ts'],
        borrowedArtifactKinds: ['CODE'],
        borrowedConcepts: ['unlicensed implementation'],
        adaptationNotes: 'Must fail closed.',
        adoptionStatus: 'IMPLEMENTED',
        implementationEvidence: [
          {
            evidenceId: 'repo:example:implementation',
            kind: 'REPO_PATH',
            locator: 'repo:packages/example/src/index.ts',
          },
        ],
      }),
    /LICENSE_NOT_VERIFIED/,
  );
});

test('verification history keeps latest license state authoritative for new mappings', () => {
  const registry = new ReferenceProvenanceRegistry();
  registry.registerReference(baseReference());

  registry.registerSourceVerification(
    verification('github:example/permissive', {
      verificationId: 'verify:example:old',
      verifiedAt: '2026-09-19T00:00:00Z',
    }),
  );
  registry.registerSourceVerification(
    verification('github:example/permissive', {
      verificationId: 'verify:example:new',
      verifiedAt: '2026-09-20T00:00:00Z',
      licenseExpression: 'GPL-3.0',
      licenseReusePolicy: 'COPYLEFT_REVIEW_REQUIRED',
    }),
  );

  assert.equal(
    registry.latestSourceVerification(
      'github:example/permissive',
    )?.verificationId,
    'verify:example:new',
  );

  assert.throws(
    () =>
      registry.registerMapping({
        mappingId: 'map:example:latest-license-wins',
        referenceId: 'github:example/permissive',
        subsystem: 'Example',
        targetPaths: ['packages/example/src/index.ts'],
        borrowedArtifactKinds: ['CODE'],
        borrowedConcepts: ['historical license state test'],
        adaptationNotes: 'Latest verification must govern.',
        adoptionStatus: 'IMPLEMENTED',
        implementationEvidence: [
          {
            evidenceId: 'repo:example:implementation',
            kind: 'REPO_PATH',
            locator: 'repo:packages/example/src/index.ts',
          },
        ],
      }),
    /REUSE_REVIEW_REQUIRED/,
  );
});

test('upstream verification does not erase handoff-only implementation debt', () => {
  const registry = createInitialReferenceProvenanceRegistry();
  const reference = registry.getReference(
    'github:maariia-saez/MDP-Adaptive-GA',
  );
  const source = registry.latestSourceVerification(
    'github:maariia-saez/MDP-Adaptive-GA',
  );

  assert.equal(reference?.traceabilityStatus, 'HANDOFF_ONLY');
  assert.equal(source?.sourceVerificationStatus, 'PINNED');
  assert.equal(source?.licenseExpression, 'MIT');

  const report =
    buildReferenceSourceVerificationReport(registry);
  assert.ok(
    report.unresolvedProvenanceDespiteVerifiedSourceIds.includes(
      'github:maariia-saez/MDP-Adaptive-GA',
    ),
  );
});

test('initial source-verification report exposes no-license and review debt', () => {
  const report = buildReferenceSourceVerificationReport(
    createInitialReferenceProvenanceRegistry(),
  );

  assert.ok(
    report.noLicenseReferenceIds.includes(
      'github:RC-Dynamics/Coach-RL',
    ),
  );
  assert.ok(
    report.noLicenseReferenceIds.includes(
      'github:pump-fun/pump-public-docs',
    ),
  );
  assert.ok(
    report.licenseReviewRequiredReferenceIds.includes(
      'provider:reticulum',
    ),
  );
  assert.ok(
    report.licenseReviewRequiredReferenceIds.includes(
      'provider:comfyui',
    ),
  );
  assert.ok(
    report.permissiveReuseReferenceIds.includes(
      'github:godotengine/godot',
    ),
  );
  assert.ok(
    report.unpinnedApiContractReferenceIds.includes(
      'api:stripe',
    ),
  );
  assert.ok(report.totalVerifiedSources >= 20);
});

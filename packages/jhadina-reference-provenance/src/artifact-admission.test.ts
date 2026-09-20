import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  ReferenceProvenanceRegistry,
} from './index.js';
import {
  ArtifactAdmissionGate,
  buildArtifactCompatibilityManifest,
  type ArtifactLicenseReviewReceipt,
  type ArtifactRuntimeDescriptor,
} from './artifact-admission.js';
import {
  createInitialReferenceProvenanceRegistry,
} from './seed-registry.js';

const BYTES = new TextEncoder().encode('model-bytes-v1');
const SOURCE_REVISION =
  '1111111111111111111111111111111111111111';
const RUNTIME: ArtifactRuntimeDescriptor = {
  runtimeName: 'jhadina-model-host',
  runtimeVersion: '1.0.0',
  platform: 'linux',
  architecture: 'x64',
  accelerator: 'cuda-13',
};

function digest(bytes: Uint8Array): string {
  return (
    'sha256:' +
    createHash('sha256').update(bytes).digest('hex')
  );
}

function fixtureRegistry(options?: {
  reusePolicy?:
    | 'PERMISSIVE'
    | 'COPYLEFT_REVIEW_REQUIRED'
    | 'CUSTOM_REVIEW_REQUIRED'
    | 'NO_LICENSE';
  licenseFinding?: 'VERIFIED' | 'NO_LICENSE_FILE';
  sourceRevision?: string;
  pinSourceRevision?: string;
}): ReferenceProvenanceRegistry {
  const reusePolicy = options?.reusePolicy ?? 'PERMISSIVE';
  const licenseFinding =
    options?.licenseFinding ??
    (reusePolicy === 'NO_LICENSE'
      ? 'NO_LICENSE_FILE'
      : 'VERIFIED');
  const sourceRevision =
    options?.sourceRevision ?? SOURCE_REVISION;
  const pinSourceRevision =
    options?.pinSourceRevision ?? sourceRevision;

  const registry = new ReferenceProvenanceRegistry();
  registry.registerReference({
    referenceId: 'model:fixture',
    canonicalName: 'Fixture Model',
    kind: 'MODEL',
    roles: ['MODEL_REFERENCE', 'API_PROVIDER'],
    canonicalLocator: 'https://github.com/example/fixture-model',
    discoveredFrom: 'REPOSITORY',
    traceabilityStatus: 'REPO_TRACEABLE',
    licenseStatus: 'UNKNOWN',
    evidence: [
      {
        evidenceId: 'repo:fixture:model',
        kind: 'REPO_PATH',
        locator: 'repo:fixtures/model',
      },
    ],
  });

  registry.registerSourceVerification({
    verificationId: 'verify:fixture:source',
    referenceId: 'model:fixture',
    canonicalSourceLocator:
      'https://github.com/example/fixture-model',
    sourceVerificationStatus: 'PINNED',
    sourceRevision,
    sourceDigest: 'git-commit-sha1:' + sourceRevision,
    verifiedAt: '2026-09-20T04:30:00Z',
    licenseFinding,
    licenseExpression:
      licenseFinding === 'VERIFIED' ? 'MIT-or-review' : undefined,
    licenseEvidenceLocator:
      licenseFinding === 'VERIFIED'
        ? 'https://github.com/example/fixture-model/blob/main/LICENSE'
        : undefined,
    licenseReusePolicy: reusePolicy,
    evidence: [
      {
        evidenceId: 'commit:fixture:source',
        kind: 'COMMIT',
        locator:
          'https://github.com/example/fixture-model/commit/' +
          sourceRevision,
      },
    ],
  });

  registry.registerProviderContract({
    contractId: 'contract:fixture:v1',
    referenceId: 'model:fixture',
    providerId: 'fixture-provider',
    protocol: 'LOCAL_ADAPTER',
    baseLocator: 'urn:provider:fixture',
    versionStrategy: 'PROTOCOL',
    versionValue: 'fixture=1',
    endpoints: [
      {
        operationId: 'infer',
        method: 'POST',
        pathTemplate: '/infer',
        requiredRequestHeaders: [],
        requiredRequestFields: ['input'],
        requiredResponseFields: ['output'],
      },
    ],
    verifiedAt: '2026-09-20T04:30:00Z',
    evidence: [
      {
        evidenceId: 'repo:fixture:provider',
        kind: 'REPO_PATH',
        locator: 'repo:fixtures/provider.ts',
      },
    ],
  });

  registry.registerArtifactPin({
    pinId: 'artifact:fixture:v1',
    referenceId: 'model:fixture',
    artifactId: 'fixture:model-v1',
    artifactKind: 'MODEL_WEIGHTS',
    status: 'PINNED',
    locator: 'urn:artifact:fixture:model-v1',
    version: '1',
    sourceRevision: pinSourceRevision,
    digestAlgorithm: 'SHA256',
    digest: digest(BYTES),
    byteLength: BYTES.byteLength,
    verifiedAt: '2026-09-20T04:30:00Z',
    evidence: [
      {
        evidenceId: 'repo:fixture:artifact',
        kind: 'REPO_PATH',
        locator: 'repo:fixtures/model-v1.bin',
      },
    ],
  });

  return registry;
}

function manifest(registry: ReferenceProvenanceRegistry) {
  return buildArtifactCompatibilityManifest(registry, {
    manifestId: 'manifest:fixture:v1',
    pinId: 'artifact:fixture:v1',
    artifactId: 'fixture:model-v1',
    supportedRuntimes: [RUNTIME],
    requiredProviderContractIds: ['contract:fixture:v1'],
    createdAt: '2026-09-20T04:31:00Z',
    evidence: [
      {
        evidenceId: 'repo:fixture:compat',
        kind: 'REPO_PATH',
        locator: 'repo:fixtures/compatibility.json',
      },
    ],
  });
}

function allowReview(): ArtifactLicenseReviewReceipt {
  return {
    receiptId: 'license-review:fixture:1',
    referenceId: 'model:fixture',
    sourceVerificationId: 'verify:fixture:source',
    scope: 'RUNTIME_USE',
    decision: 'ALLOW',
    reviewerId: 'reviewer:fixture',
    reviewedAt: '2026-09-20T04:31:30Z',
    evidenceRefs: ['review:evidence:1'],
  };
}

test('permissive pinned artifact admits and produces zero-authority receipt', () => {
  const registry = fixtureRegistry();
  const gate = new ArtifactAdmissionGate(registry);
  const receipt = gate.admit({
    admissionId: 'admission:fixture:1',
    pinId: 'artifact:fixture:v1',
    bytes: BYTES,
    compatibilityManifest: manifest(registry),
    runtime: RUNTIME,
    activeProviderContractIds: ['contract:fixture:v1'],
    admittedAt: '2026-09-20T04:32:00Z',
  });

  assert.equal(receipt.artifactDigest, digest(BYTES));
  assert.equal(receipt.licenseBasis, 'PERMISSIVE_VERIFIED');
  assert.equal(receipt.sourceRevision, SOURCE_REVISION);
  assert.equal(receipt.authority.runtimeAuthority, 'NONE');
  assert.equal(receipt.authority.executionAuthority, 'NONE');
  assert.ok(receipt.registryHash.length > 20);
  assert.ok(receipt.receiptHash.length > 20);
});

test('unresolved production artifact cannot receive a compatibility manifest', () => {
  const registry = createInitialReferenceProvenanceRegistry();

  assert.throws(
    () =>
      buildArtifactCompatibilityManifest(registry, {
        manifestId: 'manifest:sam2:unresolved',
        pinId: 'artifact:sam2:checkpoint',
        artifactId: 'sam2:runtime-checkpoint',
        supportedRuntimes: [RUNTIME],
        requiredProviderContractIds: [],
        createdAt: '2026-09-20T04:31:00Z',
        evidence: [
          {
            evidenceId: 'repo:sam2:manifest',
            kind: 'REPO_PATH',
            locator: 'repo:services/tracking-service/worker.py',
          },
        ],
      }),
    /MANIFEST_REQUIRES_PINNED_ARTIFACT/,
  );
});

test('artifact digest mismatch is rejected before admission receipt exists', () => {
  const registry = fixtureRegistry();
  const gate = new ArtifactAdmissionGate(registry);

  assert.throws(
    () =>
      gate.admit({
        admissionId: 'admission:fixture:bad-bytes',
        pinId: 'artifact:fixture:v1',
        bytes: new TextEncoder().encode('tampered'),
        compatibilityManifest: manifest(registry),
        runtime: RUNTIME,
        activeProviderContractIds: ['contract:fixture:v1'],
        admittedAt: '2026-09-20T04:32:00Z',
      }),
    /ARTIFACT_DIGEST_MISMATCH/,
  );
  assert.equal(gate.listAdmissions().length, 0);
});

test('source revision mismatch between pin and verification is rejected', () => {
  const registry = fixtureRegistry({
    pinSourceRevision:
      '2222222222222222222222222222222222222222',
  });
  const gate = new ArtifactAdmissionGate(registry);

  assert.throws(
    () =>
      gate.admit({
        admissionId: 'admission:fixture:revision-mismatch',
        pinId: 'artifact:fixture:v1',
        bytes: BYTES,
        compatibilityManifest: manifest(registry),
        runtime: RUNTIME,
        activeProviderContractIds: ['contract:fixture:v1'],
        admittedAt: '2026-09-20T04:32:00Z',
      }),
    /SOURCE_REVISION_MISMATCH/,
  );
});

test('copyleft/custom source requires bound runtime-use review receipt', () => {
  const registry = fixtureRegistry({
    reusePolicy: 'COPYLEFT_REVIEW_REQUIRED',
  });
  const gate = new ArtifactAdmissionGate(registry);
  const compatibility = manifest(registry);

  assert.throws(
    () =>
      gate.admit({
        admissionId: 'admission:fixture:review-missing',
        pinId: 'artifact:fixture:v1',
        bytes: BYTES,
        compatibilityManifest: compatibility,
        runtime: RUNTIME,
        activeProviderContractIds: ['contract:fixture:v1'],
        admittedAt: '2026-09-20T04:32:00Z',
      }),
    /LICENSE_REVIEW_REQUIRED/,
  );

  const receipt = gate.admit({
    admissionId: 'admission:fixture:reviewed',
    pinId: 'artifact:fixture:v1',
    bytes: BYTES,
    compatibilityManifest: compatibility,
    runtime: RUNTIME,
    activeProviderContractIds: ['contract:fixture:v1'],
    admittedAt: '2026-09-20T04:32:00Z',
    licenseReviewReceipt: allowReview(),
  });

  assert.equal(receipt.licenseBasis, 'EXPLICIT_REVIEW');
  assert.equal(
    receipt.licenseReviewReceiptId,
    'license-review:fixture:1',
  );
});

test('no-license source cannot be admitted even with a review receipt', () => {
  const registry = fixtureRegistry({
    reusePolicy: 'NO_LICENSE',
    licenseFinding: 'NO_LICENSE_FILE',
  });
  const gate = new ArtifactAdmissionGate(registry);

  assert.throws(
    () =>
      gate.admit({
        admissionId: 'admission:fixture:no-license',
        pinId: 'artifact:fixture:v1',
        bytes: BYTES,
        compatibilityManifest: manifest(registry),
        runtime: RUNTIME,
        activeProviderContractIds: ['contract:fixture:v1'],
        admittedAt: '2026-09-20T04:32:00Z',
        licenseReviewReceipt: allowReview(),
      }),
    /LICENSE_NOT_ADMISSIBLE/,
  );
});

test('runtime and provider contract compatibility fail closed', () => {
  const registry = fixtureRegistry();
  const compatibility = manifest(registry);
  const gate = new ArtifactAdmissionGate(registry);

  assert.throws(
    () =>
      gate.admit({
        admissionId: 'admission:fixture:wrong-runtime',
        pinId: 'artifact:fixture:v1',
        bytes: BYTES,
        compatibilityManifest: compatibility,
        runtime: { ...RUNTIME, runtimeVersion: '2.0.0' },
        activeProviderContractIds: ['contract:fixture:v1'],
        admittedAt: '2026-09-20T04:32:00Z',
      }),
    /RUNTIME_INCOMPATIBLE/,
  );

  assert.throws(
    () =>
      gate.admit({
        admissionId: 'admission:fixture:missing-contract',
        pinId: 'artifact:fixture:v1',
        bytes: BYTES,
        compatibilityManifest: compatibility,
        runtime: RUNTIME,
        activeProviderContractIds: [],
        admittedAt: '2026-09-20T04:32:00Z',
      }),
    /REQUIRED_PROVIDER_CONTRACT_MISSING/,
  );
});

test('runtime attestation binds loaded bytes and runtime instance to admission', () => {
  const registry = fixtureRegistry();
  const gate = new ArtifactAdmissionGate(registry);
  const receipt = gate.admit({
    admissionId: 'admission:fixture:attest',
    pinId: 'artifact:fixture:v1',
    bytes: BYTES,
    compatibilityManifest: manifest(registry),
    runtime: RUNTIME,
    activeProviderContractIds: ['contract:fixture:v1'],
    admittedAt: '2026-09-20T04:32:00Z',
  });

  const attestation = gate.attest({
    attestationId: 'attestation:fixture:1',
    admissionReceipt: receipt,
    runtimeInstanceId: 'runtime-instance:fixture:1',
    runtime: RUNTIME,
    observedArtifactDigest: digest(BYTES),
    loadedAt: '2026-09-20T04:33:00Z',
  });

  assert.equal(attestation.admissionReceiptHash, receipt.receiptHash);
  assert.equal(attestation.artifactDigest, digest(BYTES));
  assert.equal(attestation.authority.factualAuthority, 'NONE');
  assert.ok(attestation.attestationHash.length > 20);

  assert.throws(
    () =>
      gate.attest({
        attestationId: 'attestation:fixture:bad-digest',
        admissionReceipt: receipt,
        runtimeInstanceId: 'runtime-instance:fixture:2',
        runtime: RUNTIME,
        observedArtifactDigest:
          'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        loadedAt: '2026-09-20T04:33:00Z',
      }),
    /ATTESTATION_DIGEST_MISMATCH/,
  );
});

test('admission and attestation identifiers are replay-safe', () => {
  const registry = fixtureRegistry();
  const gate = new ArtifactAdmissionGate(registry);
  const compatibility = manifest(registry);
  const request = {
    admissionId: 'admission:fixture:replay',
    pinId: 'artifact:fixture:v1',
    bytes: BYTES,
    compatibilityManifest: compatibility,
    runtime: RUNTIME,
    activeProviderContractIds: ['contract:fixture:v1'],
    admittedAt: '2026-09-20T04:32:00Z',
  } as const;

  const receipt = gate.admit(request);
  assert.throws(
    () => gate.admit(request),
    /ADMISSION_ID_REPLAY/,
  );

  const attestationRequest = {
    attestationId: 'attestation:fixture:replay',
    admissionReceipt: receipt,
    runtimeInstanceId: 'runtime-instance:fixture:replay',
    runtime: RUNTIME,
    observedArtifactDigest: digest(BYTES),
    loadedAt: '2026-09-20T04:33:00Z',
  } as const;
  gate.attest(attestationRequest);
  assert.throws(
    () => gate.attest(attestationRequest),
    /ATTESTATION_ID_REPLAY/,
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  ArtifactAdmissionReceipt,
  RuntimeArtifactAttestation,
} from './artifact-admission.js';
import {
  enforceArtifactDeployment,
  InMemoryArtifactAdmissionLedger,
} from './artifact-deployment.js';

const runtime = Object.freeze({
  runtimeName: 'comfyui-host',
  runtimeVersion: '1.0.0',
  platform: 'linux',
  architecture: 'x64',
  accelerator: 'cuda-13',
});

const authority = Object.freeze({
  runtimeAuthority: 'NONE' as const,
  policyAuthority: 'NONE' as const,
  executionAuthority: 'NONE' as const,
  factualAuthority: 'NONE' as const,
});

function admission(): ArtifactAdmissionReceipt {
  return Object.freeze({
    schemaVersion: 'REF-PROV-05',
    admissionId: 'admission:1',
    pinId: 'artifact:comfyui:model-bundle',
    referenceId: 'provider:comfyui',
    artifactId: 'comfyui:runtime-model-bundle',
    artifactDigest:
      'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    pinHash: 'pin-hash',
    sourceVerificationId: 'source:1',
    sourceVerificationHash: 'source-hash',
    sourceRevision: 'revision-1',
    compatibilityManifestId: 'manifest:1',
    compatibilityManifestHash: 'manifest-hash',
    runtime,
    activeProviderContractIds: ['contract:comfyui:v1'],
    providerContractDigests: {
      'contract:comfyui:v1': 'sha256:contract',
    },
    licenseBasis: 'PERMISSIVE_VERIFIED',
    registryHash: 'registry-hash',
    admittedAt: '2026-09-20T05:00:00Z',
    receiptHash: 'admission-receipt-hash',
    authority,
  });
}

function attestation(): RuntimeArtifactAttestation {
  const receipt = admission();
  return Object.freeze({
    schemaVersion: 'REF-PROV-05',
    attestationId: 'attestation:1',
    admissionId: receipt.admissionId,
    admissionReceiptHash: receipt.receiptHash,
    pinId: receipt.pinId,
    artifactId: receipt.artifactId,
    artifactDigest: receipt.artifactDigest,
    runtimeInstanceId: 'runtime:comfyui:prod-1',
    runtime,
    loadedAt: '2026-09-20T05:01:00Z',
    attestationHash: 'attestation-hash',
    authority,
  });
}

test('durable admission must exist before attestation can be appended', async () => {
  const ledger = new InMemoryArtifactAdmissionLedger();
  await assert.rejects(
    ledger.appendAttestation(attestation()),
    /ATTESTATION_REQUIRES_DURABLE_ADMISSION/,
  );
});

test('ledger is append-only and same-id mutation fails closed', async () => {
  const ledger = new InMemoryArtifactAdmissionLedger();
  const receipt = admission();
  await ledger.appendAdmission(receipt);
  await ledger.appendAdmission(receipt);

  await assert.rejects(
    ledger.appendAdmission({
      ...receipt,
      receiptHash: 'mutated',
    }),
    /ADMISSION_IMMUTABLE/,
  );

  const loaded = attestation();
  await ledger.appendAttestation(loaded);
  await ledger.appendAttestation(loaded);
  await assert.rejects(
    ledger.appendAttestation({
      ...loaded,
      attestationHash: 'mutated',
    }),
    /ATTESTATION_IMMUTABLE/,
  );
});

test('deployment requires durable admission plus matching runtime attestation', async () => {
  const ledger = new InMemoryArtifactAdmissionLedger();
  const receipt = admission();
  const loaded = attestation();
  await ledger.appendAdmission(receipt);
  await ledger.appendAttestation(loaded);

  const deployment = await enforceArtifactDeployment(
    ledger,
    {
      deploymentId: 'deployment:director:1',
      subsystem: 'director',
      runtimeInstanceId: loaded.runtimeInstanceId,
      runtime,
      artifactId: receipt.artifactId,
      pinId: receipt.pinId,
      admissionId: receipt.admissionId,
      attestationId: loaded.attestationId,
    },
    '2026-09-20T05:02:00Z',
  );

  assert.equal(deployment.artifactDigest, receipt.artifactDigest);
  assert.equal(deployment.attestationHash, loaded.attestationHash);
});

test('deployment rejects missing, mismatched, or cross-runtime proof', async () => {
  const ledger = new InMemoryArtifactAdmissionLedger();
  const receipt = admission();
  const loaded = attestation();
  await ledger.appendAdmission(receipt);
  await ledger.appendAttestation(loaded);

  const base = {
    deploymentId: 'deployment:director:2',
    subsystem: 'director',
    runtimeInstanceId: loaded.runtimeInstanceId,
    runtime,
    artifactId: receipt.artifactId,
    pinId: receipt.pinId,
    admissionId: receipt.admissionId,
    attestationId: loaded.attestationId,
  };

  await assert.rejects(
    enforceArtifactDeployment(
      ledger,
      { ...base, admissionId: 'missing' },
      '2026-09-20T05:02:00Z',
    ),
    /ADMISSION_NOT_DURABLE/,
  );
  await assert.rejects(
    enforceArtifactDeployment(
      ledger,
      { ...base, artifactId: 'other:model' },
      '2026-09-20T05:02:00Z',
    ),
    /ADMISSION_BINDING_MISMATCH/,
  );
  await assert.rejects(
    enforceArtifactDeployment(
      ledger,
      { ...base, runtimeInstanceId: 'runtime:other' },
      '2026-09-20T05:02:00Z',
    ),
    /ATTESTATION_RUNTIME_MISMATCH/,
  );
  await assert.rejects(
    enforceArtifactDeployment(
      ledger,
      {
        ...base,
        runtime: { ...runtime, runtimeVersion: '2.0.0' },
      },
      '2026-09-20T05:02:00Z',
    ),
    /ADMISSION_RUNTIME_MISMATCH/,
  );
});

test('latest runtime attestation is deterministic', async () => {
  const ledger = new InMemoryArtifactAdmissionLedger();
  const receipt = admission();
  await ledger.appendAdmission(receipt);
  const first = attestation();
  const second = {
    ...first,
    attestationId: 'attestation:2',
    loadedAt: '2026-09-20T05:02:00Z',
    attestationHash: 'attestation-hash-2',
  };
  await ledger.appendAttestation(first);
  await ledger.appendAttestation(second);

  const latest = await ledger.latestAttestationForRuntime(
    first.runtimeInstanceId,
    first.artifactId,
  );
  assert.equal(latest?.attestationId, 'attestation:2');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  ArtifactAdmissionReceipt,
  RuntimeArtifactAttestation,
} from './artifact-admission.js';
import {
  PostgresArtifactAdmissionLedger,
  type ArtifactLedgerSqlClient,
  type ArtifactLedgerSqlResult,
} from './postgres-artifact-admission-ledger.js';

const authority = {
  runtimeAuthority: 'NONE' as const,
  policyAuthority: 'NONE' as const,
  executionAuthority: 'NONE' as const,
  factualAuthority: 'NONE' as const,
};
const runtime = {
  runtimeName: 'sam2-worker',
  runtimeVersion: '1',
  platform: 'linux',
  architecture: 'x64',
};

function admission(): ArtifactAdmissionReceipt {
  return {
    schemaVersion: 'REF-PROV-05',
    admissionId: 'admission:pg:1',
    pinId: 'artifact:sam2:checkpoint',
    referenceId: 'model:sam2',
    artifactId: 'sam2:runtime-checkpoint',
    artifactDigest:
      'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    pinHash: 'pin',
    sourceVerificationId: 'source',
    sourceVerificationHash: 'source-hash',
    compatibilityManifestId: 'manifest',
    compatibilityManifestHash: 'manifest-hash',
    runtime,
    activeProviderContractIds: [],
    providerContractDigests: {},
    licenseBasis: 'PERMISSIVE_VERIFIED',
    registryHash: 'registry',
    admittedAt: '2026-09-20T05:00:00Z',
    receiptHash:
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    authority,
  };
}

function attestation(): RuntimeArtifactAttestation {
  const receipt = admission();
  return {
    schemaVersion: 'REF-PROV-05',
    attestationId: 'attestation:pg:1',
    admissionId: receipt.admissionId,
    admissionReceiptHash: receipt.receiptHash,
    pinId: receipt.pinId,
    artifactId: receipt.artifactId,
    artifactDigest: receipt.artifactDigest,
    runtimeInstanceId: 'runtime:sam2:1',
    runtime,
    loadedAt: '2026-09-20T05:01:00Z',
    attestationHash:
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    authority,
  };
}

class MemorySql implements ArtifactLedgerSqlClient {
  readonly admissions = new Map<string, ArtifactAdmissionReceipt>();
  readonly attestations = new Map<string, RuntimeArtifactAttestation>();

  async query<Row>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<ArtifactLedgerSqlResult<Row>> {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (normalized.startsWith('INSERT INTO reference_artifact_admissions')) {
      const receipt = JSON.parse(String(params[6])) as ArtifactAdmissionReceipt;
      if (this.admissions.has(receipt.admissionId)) return { rows: [] };
      this.admissions.set(receipt.admissionId, receipt);
      return {
        rows: [
          {
            admission_id: receipt.admissionId,
            receipt_hash: receipt.receiptHash,
          } as Row,
        ],
      };
    }
    if (
      normalized.includes('FROM reference_artifact_admissions') &&
      normalized.includes('WHERE admission_id = $1')
    ) {
      const receipt = this.admissions.get(String(params[0]));
      return {
        rows: receipt
          ? [
              {
                admission_id: receipt.admissionId,
                receipt_hash: receipt.receiptHash,
                receipt_json: receipt,
              } as Row,
            ]
          : [],
      };
    }
    if (normalized.startsWith('INSERT INTO reference_artifact_attestations')) {
      const item = JSON.parse(String(params[8])) as RuntimeArtifactAttestation;
      if (this.attestations.has(item.attestationId)) return { rows: [] };
      this.attestations.set(item.attestationId, item);
      return {
        rows: [
          {
            attestation_id: item.attestationId,
            attestation_hash: item.attestationHash,
          } as Row,
        ],
      };
    }
    if (
      normalized.includes('FROM reference_artifact_attestations') &&
      normalized.includes('WHERE attestation_id = $1')
    ) {
      const item = this.attestations.get(String(params[0]));
      return {
        rows: item
          ? [
              {
                attestation_id: item.attestationId,
                attestation_hash: item.attestationHash,
                attestation_json: item,
              } as Row,
            ]
          : [],
      };
    }
    if (
      normalized.includes('FROM reference_artifact_attestations') &&
      normalized.includes('WHERE runtime_instance_id = $1')
    ) {
      const matches = [...this.attestations.values()]
        .filter(
          (item) =>
            item.runtimeInstanceId === params[0] &&
            item.artifactId === params[1],
        )
        .sort((a, b) => Date.parse(b.loadedAt) - Date.parse(a.loadedAt));
      const item = matches[0];
      return {
        rows: item
          ? [
              {
                attestation_id: item.attestationId,
                attestation_hash: item.attestationHash,
                attestation_json: item,
              } as Row,
            ]
          : [],
      };
    }

    throw new Error('UNEXPECTED_SQL:' + normalized);
  }
}

test('Postgres ledger persists and reads admission plus attestation JSON', async () => {
  const sql = new MemorySql();
  const ledger = new PostgresArtifactAdmissionLedger({ client: sql });
  const receipt = admission();
  const loaded = attestation();

  await ledger.appendAdmission(receipt);
  await ledger.appendAttestation(loaded);

  assert.deepEqual(
    await ledger.getAdmission(receipt.admissionId),
    receipt,
  );
  assert.deepEqual(
    await ledger.getAttestation(loaded.attestationId),
    loaded,
  );
  assert.equal(
    (
      await ledger.latestAttestationForRuntime(
        loaded.runtimeInstanceId,
        loaded.artifactId,
      )
    )?.attestationId,
    loaded.attestationId,
  );
});

test('Postgres ledger rejects same identifier with a different hash', async () => {
  const sql = new MemorySql();
  const ledger = new PostgresArtifactAdmissionLedger({ client: sql });
  const receipt = admission();
  await ledger.appendAdmission(receipt);

  await assert.rejects(
    ledger.appendAdmission({
      ...receipt,
      receiptHash:
        'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    }),
    /ADMISSION_IMMUTABLE/,
  );

  const loaded = attestation();
  await ledger.appendAttestation(loaded);
  await assert.rejects(
    ledger.appendAttestation({
      ...loaded,
      attestationHash:
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    }),
    /ATTESTATION_IMMUTABLE/,
  );
});

test('unsafe table names are rejected', () => {
  assert.throws(
    () =>
      new PostgresArtifactAdmissionLedger({
        client: new MemorySql(),
        admissionTableName: 'admissions;drop table users',
      }),
    /TABLE_NAME_INVALID/,
  );
});

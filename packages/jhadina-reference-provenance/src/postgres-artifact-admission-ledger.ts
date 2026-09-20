import type {
  ArtifactAdmissionReceipt,
  RuntimeArtifactAttestation,
} from './artifact-admission.js';
import type {
  ArtifactAdmissionLedger,
} from './artifact-deployment.js';

export type ArtifactLedgerSqlResult<Row> = Readonly<{
  rows: readonly Row[];
}>;

export interface ArtifactLedgerSqlClient {
  query<Row = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<ArtifactLedgerSqlResult<Row>>;
}

type AdmissionRow = {
  admission_id: string;
  receipt_hash: string;
  receipt_json: ArtifactAdmissionReceipt | string;
};

type AttestationRow = {
  attestation_id: string;
  attestation_hash: string;
  attestation_json: RuntimeArtifactAttestation | string;
};

export type PostgresArtifactAdmissionLedgerOptions = Readonly<{
  client: ArtifactLedgerSqlClient;
  admissionTableName?: string;
  attestationTableName?: string;
}>;

function safeIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error('REF_PROV_06_TABLE_NAME_INVALID');
  }
  return value;
}

function parseJson<T>(value: T | string): T {
  return typeof value === 'string'
    ? (JSON.parse(value) as T)
    : value;
}

export class PostgresArtifactAdmissionLedger
  implements ArtifactAdmissionLedger
{
  private readonly client: ArtifactLedgerSqlClient;
  private readonly admissionTable: string;
  private readonly attestationTable: string;

  constructor(options: PostgresArtifactAdmissionLedgerOptions) {
    this.client = options.client;
    this.admissionTable = safeIdentifier(
      options.admissionTableName ??
        'reference_artifact_admissions',
    );
    this.attestationTable = safeIdentifier(
      options.attestationTableName ??
        'reference_artifact_attestations',
    );
  }

  async appendAdmission(
    receipt: ArtifactAdmissionReceipt,
  ): Promise<void> {
    const result = await this.client.query<{
      admission_id: string;
      receipt_hash: string;
    }>(
      `
        INSERT INTO ${this.admissionTable} (
          admission_id, receipt_hash, artifact_id, pin_id,
          runtime_instance_scope, admitted_at, receipt_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        ON CONFLICT (admission_id) DO NOTHING
        RETURNING admission_id, receipt_hash
      `,
      [
        receipt.admissionId,
        receipt.receiptHash,
        receipt.artifactId,
        receipt.pinId,
        JSON.stringify(receipt.runtime),
        receipt.admittedAt,
        JSON.stringify(receipt),
      ],
    );

    if (result.rows.length === 1) return;

    const existing = await this.client.query<AdmissionRow>(
      `
        SELECT admission_id, receipt_hash, receipt_json
        FROM ${this.admissionTable}
        WHERE admission_id = $1
        LIMIT 1
      `,
      [receipt.admissionId],
    );
    if (
      existing.rows[0]?.receipt_hash !== receipt.receiptHash
    ) {
      throw new Error('REF_PROV_06_ADMISSION_IMMUTABLE');
    }
  }

  async getAdmission(
    admissionId: string,
  ): Promise<ArtifactAdmissionReceipt | undefined> {
    const result = await this.client.query<AdmissionRow>(
      `
        SELECT admission_id, receipt_hash, receipt_json
        FROM ${this.admissionTable}
        WHERE admission_id = $1
        LIMIT 1
      `,
      [admissionId],
    );
    const row = result.rows[0];
    return row
      ? parseJson<ArtifactAdmissionReceipt>(row.receipt_json)
      : undefined;
  }

  async appendAttestation(
    attestation: RuntimeArtifactAttestation,
  ): Promise<void> {
    const admission = await this.getAdmission(
      attestation.admissionId,
    );
    if (
      !admission ||
      admission.receiptHash !== attestation.admissionReceiptHash
    ) {
      throw new Error(
        'REF_PROV_06_ATTESTATION_REQUIRES_DURABLE_ADMISSION',
      );
    }

    const result = await this.client.query<{
      attestation_id: string;
      attestation_hash: string;
    }>(
      `
        INSERT INTO ${this.attestationTable} (
          attestation_id, attestation_hash, admission_id,
          admission_receipt_hash, artifact_id, pin_id,
          runtime_instance_id, loaded_at, attestation_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        ON CONFLICT (attestation_id) DO NOTHING
        RETURNING attestation_id, attestation_hash
      `,
      [
        attestation.attestationId,
        attestation.attestationHash,
        attestation.admissionId,
        attestation.admissionReceiptHash,
        attestation.artifactId,
        attestation.pinId,
        attestation.runtimeInstanceId,
        attestation.loadedAt,
        JSON.stringify(attestation),
      ],
    );
    if (result.rows.length === 1) return;

    const existing = await this.client.query<AttestationRow>(
      `
        SELECT attestation_id, attestation_hash, attestation_json
        FROM ${this.attestationTable}
        WHERE attestation_id = $1
        LIMIT 1
      `,
      [attestation.attestationId],
    );
    if (
      existing.rows[0]?.attestation_hash !==
      attestation.attestationHash
    ) {
      throw new Error('REF_PROV_06_ATTESTATION_IMMUTABLE');
    }
  }

  async getAttestation(
    attestationId: string,
  ): Promise<RuntimeArtifactAttestation | undefined> {
    const result = await this.client.query<AttestationRow>(
      `
        SELECT attestation_id, attestation_hash, attestation_json
        FROM ${this.attestationTable}
        WHERE attestation_id = $1
        LIMIT 1
      `,
      [attestationId],
    );
    const row = result.rows[0];
    return row
      ? parseJson<RuntimeArtifactAttestation>(
          row.attestation_json,
        )
      : undefined;
  }

  async latestAttestationForRuntime(
    runtimeInstanceId: string,
    artifactId: string,
  ): Promise<RuntimeArtifactAttestation | undefined> {
    const result = await this.client.query<AttestationRow>(
      `
        SELECT attestation_id, attestation_hash, attestation_json
        FROM ${this.attestationTable}
        WHERE runtime_instance_id = $1
          AND artifact_id = $2
        ORDER BY loaded_at DESC, attestation_id DESC
        LIMIT 1
      `,
      [runtimeInstanceId, artifactId],
    );
    const row = result.rows[0];
    return row
      ? parseJson<RuntimeArtifactAttestation>(
          row.attestation_json,
        )
      : undefined;
  }
}

import type { SpatialEvidence } from './evidence.js';
import { spatialEvidenceHash } from './evidence-hash.js';
import type { SpatialEvidenceStore } from './evidence-store.js';

/** Minimal SQL surface; the core package remains independent of a DB driver. */
export type SpatialEvidenceSqlClient = {
  query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
};

export type PostgresSpatialEvidenceStoreOptions = {
  client: SpatialEvidenceSqlClient;
  tableName?: string;
};

type EvidenceRow = {
  evidence_id: string;
  observation_id: string;
  provider: string;
  record_id: string | null;
  attribution: string | null;
  observed_at: string | null;
  received_at: string;
  completeness: SpatialEvidence['coverage']['completeness'];
  coverage: SpatialEvidence['coverage']['coverage'];
  freshness: SpatialEvidence['coverage']['freshness'];
  payload: SpatialEvidence['payload'];
  adapter: string;
  adapter_version: string;
  content_hash: string;
};

function safeIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('SPATIAL_EVIDENCE_TABLE_INVALID');
  return value;
}

function fromRow(row: EvidenceRow): SpatialEvidence {
  return {
    evidenceId: row.evidence_id,
    observationId: row.observation_id,
    source: { provider: row.provider, recordId: row.record_id, attribution: row.attribution },
    timing: { observedAt: row.observed_at, receivedAt: row.received_at },
    coverage: { completeness: row.completeness, coverage: row.coverage, freshness: row.freshness },
    payload: row.payload,
    transformation: { adapter: row.adapter, adapterVersion: row.adapter_version, normalized: true },
    integrity: { contentHash: row.content_hash },
  };
}

function withoutIntegrity(evidence: SpatialEvidence): Omit<SpatialEvidence, 'integrity'> {
  const { integrity: _integrity, ...value } = evidence;
  return value;
}

/** PostgreSQL-backed append-only evidence store. The database migration owns immutability constraints. */
export class PostgresSpatialEvidenceStore implements SpatialEvidenceStore {
  private readonly client: SpatialEvidenceSqlClient;
  private readonly table: string;

  constructor(options: PostgresSpatialEvidenceStoreOptions) {
    this.client = options.client;
    this.table = safeIdentifier(options.tableName ?? 'jhadina_spatial_evidence');
  }

  async append(evidence: SpatialEvidence): Promise<'APPENDED' | 'DUPLICATE'> {
    const expectedHash = spatialEvidenceHash(withoutIntegrity(evidence));
    if (expectedHash !== evidence.integrity.contentHash) {
      throw new Error('SPATIAL_EVIDENCE_CONTENT_HASH_MISMATCH');
    }

    const result = await this.client.query<EvidenceRow>(
      `INSERT INTO ${this.table}
        (evidence_id, observation_id, provider, record_id, attribution,
         observed_at, received_at, completeness, coverage, freshness,
         payload, adapter, adapter_version, content_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)
       ON CONFLICT (content_hash) DO NOTHING
       RETURNING evidence_id, observation_id, provider, record_id, attribution,
                 observed_at, received_at, completeness, coverage, freshness,
                 payload, adapter, adapter_version, content_hash`,
      [
        evidence.evidenceId,
        evidence.observationId,
        evidence.source.provider,
        evidence.source.recordId,
        evidence.source.attribution,
        evidence.timing.observedAt,
        evidence.timing.receivedAt,
        evidence.coverage.completeness,
        evidence.coverage.coverage,
        evidence.coverage.freshness,
        JSON.stringify(evidence.payload),
        evidence.transformation.adapter,
        evidence.transformation.adapterVersion,
        evidence.integrity.contentHash,
      ],
    );

    if (result.rows[0]) return 'APPENDED';

    const existing = await this.client.query<{ evidence_id: string }>(
      `SELECT evidence_id FROM ${this.table} WHERE content_hash=$1 LIMIT 1`,
      [evidence.integrity.contentHash],
    );
    if (existing.rows[0]) return 'DUPLICATE';
    throw new Error('SPATIAL_EVIDENCE_APPEND_UNCONFIRMED');
  }

  async get(evidenceId: string): Promise<SpatialEvidence | undefined> {
    const result = await this.client.query<EvidenceRow>(
      `SELECT evidence_id, observation_id, provider, record_id, attribution,
              observed_at, received_at, completeness, coverage, freshness,
              payload, adapter, adapter_version, content_hash
       FROM ${this.table} WHERE evidence_id=$1 LIMIT 1`,
      [evidenceId],
    );
    const row = result.rows[0];
    return row ? fromRow(row) : undefined;
  }
}

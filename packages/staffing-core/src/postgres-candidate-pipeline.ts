import type { CandidatePipelineRecord, CandidatePipelineStore } from "./candidate-pipeline.js";
import type { SqlExecutor } from "./postgres-adapters.js";

export class PostgresCandidatePipelineStore implements CandidatePipelineStore {
  constructor(private readonly db: SqlExecutor) {}

  async find(applicationId: string): Promise<CandidatePipelineRecord | null> {
    const rows = await this.db.query<CandidatePipelineRecord>(
      `select application_id as "applicationId", organization_id as "organizationId", job_id as "jobId",
              worker_id as "workerId", stage, note, updated_at as "updatedAt"
       from staffing_candidate_pipeline where application_id = $1`,
      [applicationId],
    );
    return rows[0] ?? null;
  }

  async save(record: CandidatePipelineRecord): Promise<CandidatePipelineRecord> {
    const rows = await this.db.query<CandidatePipelineRecord>(
      `insert into staffing_candidate_pipeline
       (application_id, organization_id, job_id, worker_id, stage, note, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (application_id) do update set stage = excluded.stage, note = excluded.note, updated_at = excluded.updated_at
       returning application_id as "applicationId", organization_id as "organizationId", job_id as "jobId",
                 worker_id as "workerId", stage, note, updated_at as "updatedAt"`,
      [record.applicationId, record.organizationId, record.jobId, record.workerId, record.stage, record.note, record.updatedAt],
    );
    if (!rows[0]) throw new Error("Candidate pipeline save returned no row");
    return rows[0];
  }
}

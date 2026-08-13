import type { CandidatePipelineQuery, CandidatePipelineReader, CandidatePipelineResult } from "./candidate-pipeline-query.js";
import type { CandidatePipelineRecord } from "./candidate-pipeline.js";
import type { SqlExecutor } from "./postgres-adapters.js";

export class PostgresCandidatePipelineReader implements CandidatePipelineReader {
  constructor(private readonly db: SqlExecutor) {}

  async list(query: CandidatePipelineQuery): Promise<CandidatePipelineResult> {
    const params: unknown[] = [query.organizationId];
    const where = ["organization_id = $1"];
    const add = (v: unknown) => { params.push(v); return `$${params.length}`; };
    if (query.jobId) where.push(`job_id = ${add(query.jobId)}`);
    if (query.stage) where.push(`stage = ${add(query.stage)}`);
    if (query.searchWorkerId) where.push(`worker_id::text = ${add(query.searchWorkerId)}`);
    if (query.cursor) where.push(`extract(epoch from updated_at)::bigint < ${add(Number(query.cursor))}`);
    const limit = Math.min(query.limit ?? 25, 100);
    const rows = await this.db.query<CandidatePipelineRecord>(
      `select application_id as "applicationId", organization_id as "organizationId", job_id as "jobId",
              worker_id as "workerId", stage, note, updated_at as "updatedAt"
       from staffing_candidate_pipeline
       where ${where.join(" and ")}
       order by updated_at desc, application_id desc
       limit ${add(limit + 1)}`,
      params,
    );
    const candidates = rows.slice(0, limit);
    const nextCursor = rows.length > limit && candidates.length
      ? String(Math.floor(Date.parse(candidates[candidates.length - 1].updatedAt) / 1000))
      : null;
    return { candidates, nextCursor };
  }
}

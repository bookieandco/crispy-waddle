import type { Application } from "./applications.js";
import type { CandidateStage, CandidatePipelineRecord } from "./candidate-pipeline.js";
import type { SqlExecutor } from "./postgres-adapters.js";

const transitions: Record<CandidateStage, CandidateStage[]> = {
  NEW: ["REVIEW", "REJECTED"],
  REVIEW: ["SHORTLIST", "REJECTED"],
  SHORTLIST: ["INTERVIEW", "REJECTED"],
  INTERVIEW: ["OFFER", "REJECTED"],
  OFFER: ["PLACEMENT", "REJECTED"],
  PLACEMENT: [],
  REJECTED: [],
};

export class TransactionalCandidatePipelineService {
  constructor(
    private readonly db: SqlExecutor,
    private readonly ids: { next(prefix: string): string },
    private readonly clock: { now(): string },
  ) {}

  async advance(application: Application, nextStage: CandidateStage, note = ""): Promise<CandidatePipelineRecord> {
    return this.db.transaction(async (tx) => {
      const existing = await tx.query<CandidatePipelineRecord>(
        `select application_id as "applicationId", organization_id as "organizationId", job_id as "jobId",
                worker_id as "workerId", stage, note, updated_at as "updatedAt"
         from staffing_candidate_pipeline where application_id = $1 and organization_id = $2 for update`,
        [application.id, application.organizationId],
      );
      const current = existing[0]?.stage ?? "NEW";
      if (nextStage === current) return existing[0] ?? {
        applicationId: application.id, organizationId: application.organizationId, jobId: application.jobId,
        workerId: application.workerId, stage: current, note: "", updatedAt: this.clock.now(),
      };
      if (!transitions[current].includes(nextStage)) throw new Error(`Invalid candidate transition: ${current} -> ${nextStage}`);
      const now = this.clock.now();
      const rows = await tx.query<CandidatePipelineRecord>(
        `insert into staffing_candidate_pipeline
         (application_id, organization_id, job_id, worker_id, stage, note, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (application_id) do update set stage=excluded.stage, note=excluded.note, updated_at=excluded.updated_at
         returning application_id as "applicationId", organization_id as "organizationId", job_id as "jobId",
                   worker_id as "workerId", stage, note, updated_at as "updatedAt"`,
        [application.id, application.organizationId, application.jobId, application.workerId, nextStage, note.trim(), now],
      );
      const saved = rows[0];
      if (!saved) throw new Error("Candidate pipeline update returned no row");
      await tx.query(
        `insert into staffing_event_outbox
         (id, event_type, aggregate_id, organization_id, occurred_at, payload, status, attempts, available_at)
         values ($1,'CANDIDATE_STAGE_CHANGED',$2,$3,$4,$5,'PENDING',0,$4)`,
        [this.ids.next("event"), application.id, application.organizationId, now, JSON.stringify(saved)],
      );
      return saved;
    });
  }
}

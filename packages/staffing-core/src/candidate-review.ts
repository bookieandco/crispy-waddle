import type { SqlExecutor } from "./postgres-adapters.js";

export type CandidateDecision = "ADVANCE" | "REFER" | "HOLD" | "REJECT";

export class CandidateReviewService {
  constructor(private readonly db: SqlExecutor, private readonly ids: { next(prefix: string): string }, private readonly clock: { now(): string }) {}

  async decide(input: { organizationId: string; applicationId: string; reviewerId: string; decision: CandidateDecision; note?: string }) {
    return this.db.transaction(async (tx) => {
      const rows = await tx.query<any>(`select id, job_id as "jobId", status from staffing_applications where id=$1 and organization_id=$2 for update`, [input.applicationId,input.organizationId]);
      const application = rows[0];
      if (!application) throw new Error("Application not found");
      const statusByDecision: Record<CandidateDecision,string> = { ADVANCE:"ADVANCED", REFER:"REFERRED", HOLD:"ON_HOLD", REJECT:"REJECTED" };
      const nextStatus = statusByDecision[input.decision];
      const now = this.clock.now();
      await tx.query(`update staffing_applications set status=$1, updated_at=$2 where id=$3`, [nextStatus,now,input.applicationId]);
      const review = { id:this.ids.next("candidate-review"), organizationId:input.organizationId, applicationId:input.applicationId, reviewerId:input.reviewerId, decision:input.decision, note:input.note ?? null, createdAt:now };
      await tx.query(`insert into staffing_candidate_reviews (id,organization_id,application_id,reviewer_id,decision,note,created_at) values ($1,$2,$3,$4,$5,$6,$7)`, [review.id,review.organizationId,review.applicationId,review.reviewerId,review.decision,review.note,review.createdAt]);
      await tx.query(`insert into staffing_event_outbox (id,event_type,aggregate_id,organization_id,occurred_at,payload,status,attempts,available_at) values ($1,'CANDIDATE_DECISION',$2,$3,$4,$5,'PENDING',0,$4)`, [this.ids.next("event"),input.applicationId,input.organizationId,now,JSON.stringify({applicationId:input.applicationId,jobId:application.jobId,decision:input.decision})]);
      return review;
    });
  }
}

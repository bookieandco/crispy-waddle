import type { Application } from "./applications.js";
import type { CandidateStage, CandidatePipelineRecord, CandidatePipelineStore } from "./candidate-pipeline.js";
import type { CandidatePipelineIds, CandidatePipelineClock, CandidatePipelineEvents } from "./candidate-pipeline.js";

export class CandidatePipelineMutationService {
  constructor(
    private readonly store: CandidatePipelineStore,
    private readonly ids: CandidatePipelineIds,
    private readonly clock: CandidatePipelineClock,
    private readonly events: CandidatePipelineEvents,
  ) {}

  async advance(application: Application, nextStage: CandidateStage, note = ""): Promise<CandidatePipelineRecord> {
    const existing = await this.store.find(application.id);
    const current = existing?.stage ?? "NEW";
    const transitions: Record<CandidateStage, CandidateStage[]> = {
      NEW: ["REVIEW", "REJECTED"], REVIEW: ["SHORTLIST", "REJECTED"], SHORTLIST: ["INTERVIEW", "REJECTED"],
      INTERVIEW: ["OFFER", "REJECTED"], OFFER: ["PLACEMENT", "REJECTED"], PLACEMENT: [], REJECTED: [],
    };
    if (nextStage === current) return existing ?? { applicationId: application.id, organizationId: application.organizationId, jobId: application.jobId, workerId: application.workerId, stage: current, note: "", updatedAt: this.clock.now() };
    if (!transitions[current].includes(nextStage)) throw new Error(`Invalid candidate transition: ${current} -> ${nextStage}`);
    const now = this.clock.now();
    const record = await this.store.save({ applicationId: application.id, organizationId: application.organizationId, jobId: application.jobId, workerId: application.workerId, stage: nextStage, note: note.trim(), updatedAt: now });
    await this.events.enqueue({ id: this.ids.next("event"), type: "CANDIDATE_STAGE_CHANGED", aggregateId: application.id, organizationId: application.organizationId, occurredAt: now, payload: record });
    return record;
  }
}

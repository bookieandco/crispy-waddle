import type { Application } from "./applications.js";

export type CandidateStage = "NEW" | "REVIEW" | "SHORTLIST" | "INTERVIEW" | "OFFER" | "PLACEMENT" | "REJECTED";

export interface CandidatePipelineRecord {
  applicationId: string;
  organizationId: string;
  jobId: string;
  workerId: string;
  stage: CandidateStage;
  note: string;
  updatedAt: string;
}

export interface CandidatePipelineStore {
  find(applicationId: string): Promise<CandidatePipelineRecord | null>;
  save(record: CandidatePipelineRecord): Promise<CandidatePipelineRecord>;
}

export interface CandidatePipelineEvents {
  enqueue(event: { id: string; type: "CANDIDATE_STAGE_CHANGED"; aggregateId: string; organizationId: string; occurredAt: string; payload: CandidatePipelineRecord }): Promise<void>;
}

export interface CandidatePipelineIds { next(prefix: string): string; }
export interface CandidatePipelineClock { now(): string; }

const transitions: Record<CandidateStage, CandidateStage[]> = {
  NEW: ["REVIEW", "REJECTED"],
  REVIEW: ["SHORTLIST", "REJECTED"],
  SHORTLIST: ["INTERVIEW", "REJECTED"],
  INTERVIEW: ["OFFER", "REJECTED"],
  OFFER: ["PLACEMENT", "REJECTED"],
  PLACEMENT: [],
  REJECTED: [],
};

export class CandidatePipelineService {
  constructor(private readonly store: CandidatePipelineStore, private readonly ids: CandidatePipelineIds, private readonly clock: CandidatePipelineClock, private readonly events: CandidatePipelineEvents) {}

  async advance(application: Application, nextStage: CandidateStage, note = ""): Promise<CandidatePipelineRecord> {
    const existing = await this.store.find(application.id);
    const current = existing?.stage ?? "NEW";
    if (nextStage === current) return existing!;
    if (!transitions[current].includes(nextStage)) throw new Error(`Invalid candidate transition: ${current} -> ${nextStage}`);
    const now = this.clock.now();
    const record: CandidatePipelineRecord = { applicationId: application.id, organizationId: application.organizationId, jobId: application.jobId, workerId: application.workerId, stage: nextStage, note: note.trim(), updatedAt: now };
    const saved = await this.store.save(record);
    await this.events.enqueue({ id: this.ids.next("event"), type: "CANDIDATE_STAGE_CHANGED", aggregateId: application.id, organizationId: application.organizationId, occurredAt: now, payload: saved });
    return saved;
  }
}

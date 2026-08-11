import type { CandidateStage, CandidatePipelineRecord } from "./candidate-pipeline.js";

export interface CandidatePipelineQuery {
  organizationId: string;
  jobId?: string;
  stage?: CandidateStage;
  searchWorkerId?: string;
  limit?: number;
  cursor?: string;
}

export interface CandidatePipelineResult {
  candidates: CandidatePipelineRecord[];
  nextCursor: string | null;
}

export interface CandidatePipelineReader {
  list(query: CandidatePipelineQuery): Promise<CandidatePipelineResult>;
}

export class CandidatePipelineQueryService {
  constructor(private readonly reader: CandidatePipelineReader) {}

  list(query: CandidatePipelineQuery): Promise<CandidatePipelineResult> {
    if (!query.organizationId) throw new Error("organizationId is required");
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    return this.reader.list({ ...query, limit });
  }
}

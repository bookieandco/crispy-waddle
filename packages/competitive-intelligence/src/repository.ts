import type { CompetitiveEvidence, CompetitorObservation } from "@jhadina/opportunity-contracts";
import type { CompetitiveEvidenceRecorder, RawCompetitiveObservation } from "./index";

export interface CompetitiveEvidenceRepository {
  recordObservation(input: RawCompetitiveObservation): CompetitiveEvidence<CompetitorObservation>;
  get(ownerId: string, evidenceId: string): CompetitiveEvidence<CompetitorObservation> | undefined;
}

export class InMemoryCompetitiveEvidenceRepository implements CompetitiveEvidenceRepository {
  private readonly records = new Map<string, CompetitiveEvidence<CompetitorObservation>>();

  constructor(private readonly recorder: CompetitiveEvidenceRecorder) {}

  recordObservation(input: RawCompetitiveObservation): CompetitiveEvidence<CompetitorObservation> {
    const evidence = this.recorder.recordObservation(input);
    const existing = this.records.get(evidence.evidenceId);
    if (existing) return existing;

    const immutable = Object.freeze({
      ...evidence,
      value: Object.freeze({ ...evidence.value }),
      source: evidence.source ? Object.freeze({ ...evidence.source }) : undefined,
    });
    this.records.set(evidence.evidenceId, immutable);
    return immutable;
  }

  get(ownerId: string, evidenceId: string): CompetitiveEvidence<CompetitorObservation> | undefined {
    const evidence = this.records.get(evidenceId);
    return evidence?.ownerId === ownerId ? evidence : undefined;
  }
}

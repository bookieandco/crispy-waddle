import type {
  CompetitiveEvidence,
  CompetitiveEvidenceSource,
  CompetitorObservation,
} from "@jhadina/opportunity-contracts";

export interface RawCompetitiveObservation {
  source: CompetitiveEvidenceSource;
  observation: CompetitorObservation;
}

export interface CompetitiveEvidenceRecorder {
  recordObservation(input: RawCompetitiveObservation): CompetitiveEvidence<CompetitorObservation>;
}

export class DeterministicCompetitiveEvidenceRecorder implements CompetitiveEvidenceRecorder {
  recordObservation(input: RawCompetitiveObservation): CompetitiveEvidence<CompetitorObservation> {
    const observedAt = new Date(input.observation.observedAt).toISOString();
    const sourceObservedAt = new Date(input.source.observedAt).toISOString();

    if (Number.isNaN(Date.parse(observedAt)) || Number.isNaN(Date.parse(sourceObservedAt))) {
      throw new Error("Competitive observation timestamps must be valid ISO dates");
    }
    if (input.observation.competitorId.trim() === "") {
      throw new Error("Competitor ID is required");
    }
    if (input.source.sourceId.trim() === "" || input.source.locator.trim() === "") {
      throw new Error("Evidence source ID and locator are required");
    }

    const observation = Object.freeze({
      ...input.observation,
      observedAt,
    });

    return Object.freeze({
      evidenceId: this.idFor(input.source.sourceId, input.observation),
      kind: "observed_fact",
      subjectId: input.observation.productId ?? input.observation.competitorId,
      value: observation,
      source: Object.freeze({ ...input.source, observedAt: sourceObservedAt }),
      createdAt: observedAt,
    });
  }

  private idFor(sourceId: string, observation: CompetitorObservation): string {
    return [
      sourceId,
      observation.competitorId,
      observation.productId ?? "",
      observation.marketplace ?? "",
      observation.listingUrl ?? "",
      observation.observedAt,
    ].join(":");
  }
}

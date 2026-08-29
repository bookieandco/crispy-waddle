import type { PerceptionObservation } from "./perception-contract";

export interface PerceptionExperienceCandidate {
  id: string;
  kind: "perception";
  occurredAt: string;
  source: PerceptionObservation["event"]["source"];
  summary?: string;
  entities: string[];
  confidence: number;
  salience: number;
  contentRef: string;
}

export function toExperienceCandidate(
  observation: PerceptionObservation,
  id: string,
): PerceptionExperienceCandidate {
  return {
    id,
    kind: "perception",
    occurredAt: observation.event.occurredAt,
    source: observation.event.source,
    summary: observation.summary,
    entities: observation.entities ?? [],
    confidence: observation.event.confidence,
    salience: observation.salience ?? 0,
    contentRef: observation.event.contentRef,
  };
}

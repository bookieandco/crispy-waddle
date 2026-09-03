import type {
  RestorationCandidate,
  RestorationEvidence,
  RestorationPlan,
} from "./types.js";

export interface RestorationAdapter {
  readonly id: string;
  readonly operationClass: RestorationCandidate["operationClass"];
  supports(operation: string, evidence: readonly RestorationEvidence[]): boolean;
  propose(input: {
    plan: RestorationPlan;
    evidence: readonly RestorationEvidence[];
  }): readonly RestorationCandidate[];
}

/**
 * Candidate generation only. It never selects, renders, or commits a repair.
 * The no-op candidate is always available so preservation remains a first-class option.
 */
export class RestorationCandidateEngine {
  constructor(private readonly adapters: readonly RestorationAdapter[] = []) {}

  generate(
    plan: RestorationPlan,
    evidence: readonly RestorationEvidence[],
  ): readonly RestorationCandidate[] {
    const noOp: RestorationCandidate = {
      id: `${plan.id}:no-op`,
      operation: "preserve-original",
      operationClass: "correction",
      status: "proposed",
      inputArtifactId: plan.sourceVersionId,
      parameters: {},
      evidenceIds: evidence.map((item) => item.id),
      provenance: "original",
    };

    const candidates = this.adapters.flatMap((adapter) =>
      adapter.supports(
        plan.candidates[0]?.operation ?? "unknown",
        evidence,
      )
        ? adapter.propose({ plan, evidence })
        : [],
    );

    return [noOp, ...candidates];
  }
}

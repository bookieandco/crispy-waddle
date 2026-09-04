import type { RestorationHypothesis } from "./restoration-hypothesis.js";
import type { RestorationExperimentCandidate } from "./hypothesis-experiment.js";

export interface ExperimentAuthorization {
  caseId: string;
  sourceVersionId: string;
  experimentId: string;
  authorizationClass: RestorationExperimentCandidate["authorizationClass"];
  allowedRegionIds: string[];
  allowDestructive: boolean;
}

export interface ExperimentEvidence {
  evidenceId: string;
  experimentId: string;
  sourceVersionId: string;
  outcomeId: string;
  affectedRegionIds: string[];
  confidence: number;
  provenance: "experiment";
  observationHash?: string;
  notes?: string;
}

export interface ExperimentRunnerObservation {
  outcomeId: string;
  confidence: number;
  observationHash?: string;
  notes?: string;
}

export interface ExperimentRunner {
  run(experiment: RestorationExperimentCandidate): Promise<ExperimentRunnerObservation>;
}

export interface ExperimentEvidenceIdFactory {
  create(input: { experimentId: string; sourceVersionId: string; outcomeId: string }): string;
}

export async function executeAuthorizedExperiment(
  experiment: RestorationExperimentCandidate,
  authorization: ExperimentAuthorization,
  runner: ExperimentRunner,
  idFactory: ExperimentEvidenceIdFactory,
): Promise<ExperimentEvidence> {
  validateAuthorization(experiment, authorization);

  const observation = await runner.run(experiment);
  if (!experiment.outcomes.some((outcome) => outcome.outcomeId === observation.outcomeId)) {
    throw new Error("Experiment runner returned an undeclared outcome");
  }
  assertConfidence(observation.confidence);

  return {
    evidenceId: idFactory.create({
      experimentId: experiment.id,
      sourceVersionId: authorization.sourceVersionId,
      outcomeId: observation.outcomeId,
    }),
    experimentId: experiment.id,
    sourceVersionId: authorization.sourceVersionId,
    outcomeId: observation.outcomeId,
    affectedRegionIds: [...experiment.affectedRegionIds],
    confidence: observation.confidence,
    provenance: "experiment",
    observationHash: observation.observationHash,
    notes: observation.notes,
  };
}

export function applyExperimentOutcome(
  hypotheses: RestorationHypothesis[],
  experiment: RestorationExperimentCandidate,
  outcomeId: string,
  evidenceId = `experiment:${experiment.id}:${outcomeId}`,
): RestorationHypothesis[] {
  const outcome = experiment.outcomes.find((candidate) => candidate.outcomeId === outcomeId);
  if (!outcome) throw new Error("Cannot apply an undeclared experiment outcome");
  if (hypotheses.length === 0) throw new Error("At least one hypothesis is required");
  if (!evidenceId) throw new Error("Experiment evidence ID is required");

  const hypothesisIds = new Set(hypotheses.map((hypothesis) => hypothesis.id));
  for (const hypothesisId of Object.keys(outcome.hypothesisLikelihoods)) {
    if (!hypothesisIds.has(hypothesisId)) throw new Error("Experiment outcome references an unknown hypothesis");
  }

  const weighted = hypotheses.map((hypothesis) => {
    const likelihood = outcome.hypothesisLikelihoods[hypothesis.id];
    if (!Number.isFinite(likelihood) || likelihood < 0 || likelihood > 1) {
      throw new Error("Experiment outcome likelihood must be between 0 and 1");
    }
    const baseProbability = hypothesis.posterior ?? hypothesis.prior;
    return {
      ...hypothesis,
      observations: [...hypothesis.observations, { evidenceId, likelihood }],
      posterior: baseProbability * likelihood,
    };
  });

  const total = weighted.reduce((sum, hypothesis) => sum + (hypothesis.posterior ?? 0), 0);
  if (!(total > 0) || !Number.isFinite(total)) throw new Error("Experiment outcome produced no posterior mass");
  return weighted.map((hypothesis) => ({ ...hypothesis, posterior: (hypothesis.posterior ?? 0) / total }));
}

function validateAuthorization(
  experiment: RestorationExperimentCandidate,
  authorization: ExperimentAuthorization,
): void {
  if (!authorization.caseId || !authorization.sourceVersionId) throw new Error("Experiment authorization identity is required");
  if (authorization.experimentId !== experiment.id) throw new Error("Experiment authorization does not match candidate");
  if (authorization.authorizationClass !== experiment.authorizationClass) throw new Error("Experiment authorization class does not match candidate");
  if (experiment.destructive && !authorization.allowDestructive) throw new Error("Destructive experiment is not authorized");

  const allowed = new Set(authorization.allowedRegionIds);
  if (experiment.affectedRegionIds.some((regionId) => !allowed.has(regionId))) {
    throw new Error("Experiment affected region is outside the authorized region set");
  }
}

function assertConfidence(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error("Experiment evidence confidence must be between 0 and 1");
}

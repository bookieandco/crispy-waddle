import type { RestorationHypothesis } from "./restoration-hypothesis.js";
import { calculateHypothesisUncertainty } from "./hypothesis-uncertainty.js";

export interface ExperimentOutcomeModel {
  outcomeId: string;
  /** Likelihood of observing this outcome under each hypothesis, keyed by hypothesis ID. */
  hypothesisLikelihoods: Record<string, number>;
}

export interface RestorationExperimentCandidate {
  id: string;
  description: string;
  affectedRegionIds: string[];
  outcomes: ExperimentOutcomeModel[];
  cost: number;
  risk: number;
  destructive: boolean;
  authorizationClass: "analysis" | "simulation" | "restoration";
}

export interface ExperimentPolicy {
  allowAnalysis: boolean;
  allowSimulation: boolean;
  allowRestoration: boolean;
  allowDestructive: boolean;
  maxRisk: number;
  maxCost: number;
}

export interface ExperimentScore {
  experimentId: string;
  expectedInformationGain: number;
  expectedPosteriorEntropy: number;
  utility: number;
}

export interface SelectedExperiment extends ExperimentScore {
  reason: "highest-utility-safe-experiment";
}

export function calculateExpectedInformationGain(
  hypotheses: RestorationHypothesis[],
  experiment: RestorationExperimentCandidate,
): ExperimentScore {
  validateExperiment(experiment, hypotheses);
  const prior = hypotheses.map((hypothesis) => hypothesis.posterior ?? hypothesis.prior);
  const totalPrior = prior.reduce((sum, value) => sum + value, 0);
  const normalizedPrior = prior.map((value) => value / totalPrior);
  const priorEntropy = calculateHypothesisUncertainty(hypotheses).entropy;

  let expectedPosteriorEntropy = 0;
  for (const outcome of experiment.outcomes) {
    const likelihoods = outcome.hypothesisLikelihoods;
    const probabilityOfOutcome = hypotheses.reduce((sum, hypothesis, index) => {
      return sum + normalizedPrior[index] * likelihoods[hypothesis.id];
    }, 0);
    if (probabilityOfOutcome <= 0) continue;

    const posterior = hypotheses.map((hypothesis, index) => ({
      ...hypothesis,
      posterior: normalizedPrior[index] * likelihoods[hypothesis.id] / probabilityOfOutcome,
    }));
    expectedPosteriorEntropy += probabilityOfOutcome * calculateHypothesisUncertainty(posterior).entropy;
  }

  const expectedInformationGain = Math.max(0, priorEntropy - expectedPosteriorEntropy);
  return {
    experimentId: experiment.id,
    expectedInformationGain,
    expectedPosteriorEntropy,
    utility: expectedInformationGain - experiment.cost - experiment.risk,
  };
}

export function selectSafeRestorationExperiment(
  hypotheses: RestorationHypothesis[],
  experiments: RestorationExperimentCandidate[],
  policy: ExperimentPolicy,
): SelectedExperiment | null {
  const eligible = experiments
    .filter((experiment) => isPolicyEligible(experiment, policy))
    .map((experiment) => calculateExpectedInformationGain(hypotheses, experiment))
    .filter((score) => score.expectedInformationGain >= 0 && Number.isFinite(score.utility))
    .sort(compareExperimentScores);

  const selected = eligible[0];
  return selected ? { ...selected, reason: "highest-utility-safe-experiment" } : null;
}

function isPolicyEligible(experiment: RestorationExperimentCandidate, policy: ExperimentPolicy): boolean {
  if (experiment.destructive && !policy.allowDestructive) return false;
  if (experiment.cost < 0 || experiment.cost > policy.maxCost) return false;
  if (experiment.risk < 0 || experiment.risk > policy.maxRisk) return false;
  if (experiment.authorizationClass === "analysis" && !policy.allowAnalysis) return false;
  if (experiment.authorizationClass === "simulation" && !policy.allowSimulation) return false;
  if (experiment.authorizationClass === "restoration" && !policy.allowRestoration) return false;
  return true;
}

function compareExperimentScores(a: ExperimentScore, b: ExperimentScore): number {
  if (b.utility !== a.utility) return b.utility - a.utility;
  if (b.expectedInformationGain !== a.expectedInformationGain) return b.expectedInformationGain - a.expectedInformationGain;
  return a.experimentId.localeCompare(b.experimentId);
}

function validateExperiment(
  experiment: RestorationExperimentCandidate,
  hypotheses: RestorationHypothesis[],
): void {
  if (!experiment.id || !experiment.description || experiment.affectedRegionIds.length === 0 || experiment.outcomes.length === 0) {
    throw new Error("Experiment identity, description, affected regions, and outcomes are required");
  }
  if (hypotheses.length === 0) throw new Error("At least one hypothesis is required");
  if (experiment.cost < 0 || !Number.isFinite(experiment.cost)) throw new Error("Experiment cost must be finite and non-negative");
  if (experiment.risk < 0 || experiment.risk > 1 || !Number.isFinite(experiment.risk)) throw new Error("Experiment risk must be between 0 and 1");

  const ids = new Set(hypotheses.map((hypothesis) => hypothesis.id));
  const outcomeIds = new Set<string>();
  const outcomeMassByHypothesis = new Map<string, number>(hypotheses.map((hypothesis) => [hypothesis.id, 0]));

  for (const outcome of experiment.outcomes) {
    if (!outcome.outcomeId || outcomeIds.has(outcome.outcomeId)) throw new Error("Experiment outcome IDs must be unique");
    outcomeIds.add(outcome.outcomeId);
    for (const hypothesis of hypotheses) {
      const likelihood = outcome.hypothesisLikelihoods[hypothesis.id];
      if (!Number.isFinite(likelihood) || likelihood < 0 || likelihood > 1) {
        throw new Error("Experiment outcome likelihoods must be between 0 and 1");
      }
      outcomeMassByHypothesis.set(hypothesis.id, (outcomeMassByHypothesis.get(hypothesis.id) ?? 0) + likelihood);
    }
    for (const hypothesisId of Object.keys(outcome.hypothesisLikelihoods)) {
      if (!ids.has(hypothesisId)) throw new Error("Experiment contains an unknown hypothesis likelihood");
    }
  }

  for (const [hypothesisId, mass] of outcomeMassByHypothesis) {
    if (Math.abs(mass - 1) > 1e-9) throw new Error(`Outcome likelihoods for ${hypothesisId} must sum to 1`);
  }
}

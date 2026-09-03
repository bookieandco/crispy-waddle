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
    const evidenceProbability = outcome.hypothesisLikelihoods;
    const probabilityOfOutcome = hypotheses.reduce((sum, hypothesis, index) => {
      return sum + normalizedPrior[index] * evidenceProbability[hypothesis.id];
    }, 0);
    if (probabilityOfOutcome <= 0) continue;

    const posterior = hypotheses.map((hypothesis, index) => ({
      ...hypothesis,
      posterior: normalizedPrior[index] * evidenceProbability[hypothesis.id] / probabilityOfOutcome,
    }));
    expectedPosteriorEntropy += probabilityOfOutcome * calculateHypothesisUncertainty(posterior).entropy;
  }

  const expectedInformationGain = priorEntropy - expectedPosteriorEntropy;
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
  return experiment.authorizationClass === "analysis" || experiment.authorizationClass === "simulation" || experiment.authorizationClass === "restoration";
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
  if (!experiment.id || experiment.outcomes.length === 0) throw new Error("Experiment identity and outcomes are required");
  if (experiment.cost < 0 || !Number.isFinite(experiment.cost)) throw new Error("Experiment cost must be finite and non-negative");
  if (experiment.risk < 0 || experiment.risk > 1 || !Number.isFinite(experiment.risk)) throw new Error("Experiment risk must be between 0 and 1");
  const ids = new Set(hypotheses.map((hypothesis) => hypothesis.id));
  const outcomeIds = new Set<string>();
  for (const outcome of experiment.outcomes) {
    if (!outcome.outcomeId || outcomeIds.has(outcome.outcomeId)) throw new Error("Experiment outcome IDs must be unique");
    outcomeIds.add(outcome.outcomeId);
    let outcomeMass = 0;
    for (const hypothesis of hypotheses) {
      const likelihood = outcome.hypothesisLikelihoods[hypothesis.id];
      if (!Number.isFinite(likelihood) || likelihood < 0 || likelihood > 1) {
        throw new Error("Experiment outcome likelihoods must be between 0 and 1");
      }
      outcomeMass += likelihood;
    }
    if (outcomeMass === 0) throw new Error("Every experiment outcome must have positive likelihood under at least one hypothesis");
    for (const hypothesisId of Object.keys(outcome.hypothesisLikelihoods)) {
      if (!ids.has(hypothesisId)) throw new Error("Experiment contains an unknown hypothesis likelihood");
    }
  }
}

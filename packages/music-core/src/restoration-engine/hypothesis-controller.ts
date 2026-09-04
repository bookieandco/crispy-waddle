import type { RestorationHypothesis } from "./restoration-hypothesis.js";
import type { RestorationExperimentCandidate, ExperimentPolicy, SelectedExperiment } from "./hypothesis-experiment.js";
import {
  applyExperimentOutcome,
  executeAuthorizedExperiment,
  type ExperimentAuthorization,
  type ExperimentEvidence,
  type ExperimentEvidenceIdFactory,
  type ExperimentRunner,
} from "./hypothesis-experiment-executor.js";
import { calculateHypothesisUncertainty } from "./hypothesis-uncertainty.js";
import { selectSafeRestorationExperiment } from "./hypothesis-experiment.js";

export type HypothesisControllerDecision =
  | { kind: "stop"; reason: "sufficient-certainty" | "no-safe-experiment" | "budget-exhausted" | "max-iterations" }
  | { kind: "abstain"; reason: "authorization-failed" | "execution-failed" | "posterior-collapse" }
  | { kind: "continue"; experimentId: string; score: SelectedExperiment };

export interface HypothesisControllerPolicy extends ExperimentPolicy {
  maxIterations: number;
  minMaxPosterior: number;
  maxNormalizedEntropy?: number;
}

export interface HypothesisControllerState {
  caseId: string;
  sourceVersionId: string;
  hypotheses: RestorationHypothesis[];
  iteration: number;
  spentCost: number;
  evidence: ExperimentEvidence[];
}

export interface HypothesisControllerStepInput {
  state: HypothesisControllerState;
  experiments: RestorationExperimentCandidate[];
  policy: HypothesisControllerPolicy;
  authorizationFactory: (experiment: RestorationExperimentCandidate) => ExperimentAuthorization;
  runner: ExperimentRunner;
  idFactory: ExperimentEvidenceIdFactory;
}

export interface HypothesisControllerStepResult {
  state: HypothesisControllerState;
  decision: HypothesisControllerDecision;
}

export async function stepHypothesisController(
  input: HypothesisControllerStepInput,
): Promise<HypothesisControllerStepResult> {
  validateStateAndPolicy(input.state, input.policy);

  if (input.state.iteration >= input.policy.maxIterations) {
    return result(input.state, { kind: "stop", reason: "max-iterations" });
  }

  if (meetsStoppingCriterion(input.state.hypotheses, input.policy)) {
    return result(input.state, { kind: "stop", reason: "sufficient-certainty" });
  }

  const remainingCost = input.policy.maxCost - input.state.spentCost;
  if (remainingCost <= 0) {
    return result(input.state, { kind: "stop", reason: "budget-exhausted" });
  }

  const selectionPolicy: ExperimentPolicy = { ...input.policy, maxCost: remainingCost };
  const selected = selectSafeRestorationExperiment(input.state.hypotheses, input.experiments, selectionPolicy);
  if (!selected || selected.utility <= 0) {
    return result(input.state, { kind: "stop", reason: "no-safe-experiment" });
  }

  const experiment = input.experiments.find((candidate) => candidate.id === selected.experimentId);
  if (!experiment) {
    return result(input.state, { kind: "abstain", reason: "authorization-failed" });
  }

  let evidence: ExperimentEvidence;
  try {
    const authorization = input.authorizationFactory(experiment);
    evidence = await executeAuthorizedExperiment(experiment, authorization, input.runner, input.idFactory);
  } catch {
    return result(input.state, { kind: "abstain", reason: "execution-failed" });
  }

  let hypotheses: RestorationHypothesis[];
  try {
    hypotheses = applyExperimentOutcome(input.state.hypotheses, experiment, evidence.outcomeId, evidence.evidenceId);
  } catch {
    return result(input.state, { kind: "abstain", reason: "posterior-collapse" });
  }

  const nextState: HypothesisControllerState = {
    ...input.state,
    hypotheses,
    iteration: input.state.iteration + 1,
    spentCost: input.state.spentCost + experiment.cost,
    evidence: [...input.state.evidence, evidence],
  };

  const decision = meetsStoppingCriterion(hypotheses, input.policy)
    ? ({ kind: "stop", reason: "sufficient-certainty" } as const)
    : ({ kind: "continue", experimentId: experiment.id, score: selected } as const);

  return result(nextState, decision);
}

function meetsStoppingCriterion(
  hypotheses: RestorationHypothesis[],
  policy: HypothesisControllerPolicy,
): boolean {
  const uncertainty = calculateHypothesisUncertainty(hypotheses);
  if (uncertainty.maxPosterior >= policy.minMaxPosterior) return true;
  return policy.maxNormalizedEntropy !== undefined && uncertainty.normalizedEntropy <= policy.maxNormalizedEntropy;
}

function validateStateAndPolicy(
  state: HypothesisControllerState,
  policy: HypothesisControllerPolicy,
): void {
  if (!state.caseId || !state.sourceVersionId) throw new Error("Hypothesis controller state identity is required");
  if (!Number.isInteger(state.iteration) || state.iteration < 0) throw new Error("Controller iteration must be a non-negative integer");
  if (!Number.isFinite(state.spentCost) || state.spentCost < 0) throw new Error("Controller spent cost must be finite and non-negative");
  if (!Number.isInteger(policy.maxIterations) || policy.maxIterations < 0) throw new Error("Controller max iterations must be a non-negative integer");
  if (!Number.isFinite(policy.minMaxPosterior) || policy.minMaxPosterior < 0 || policy.minMaxPosterior > 1) {
    throw new Error("Minimum maximum posterior must be between 0 and 1");
  }
  if (policy.maxNormalizedEntropy !== undefined &&
      (!Number.isFinite(policy.maxNormalizedEntropy) || policy.maxNormalizedEntropy < 0 || policy.maxNormalizedEntropy > 1)) {
    throw new Error("Maximum normalized entropy must be between 0 and 1");
  }
  if (state.spentCost > policy.maxCost) throw new Error("Controller spent cost exceeds policy budget");
  if (state.hypotheses.length === 0) throw new Error("At least one hypothesis is required");
}

function result(state: HypothesisControllerState, decision: HypothesisControllerDecision): HypothesisControllerStepResult {
  return { state: { ...state, hypotheses: [...state.hypotheses], evidence: [...state.evidence] }, decision };
}

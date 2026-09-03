import type { RestorationHypothesis } from "./restoration-hypothesis.js";

export interface HypothesisUncertainty {
  entropy: number;
  normalizedEntropy: number;
  maxPosterior: number;
  effectiveHypothesisCount: number;
}

export function calculateHypothesisUncertainty(
  hypotheses: RestorationHypothesis[],
): HypothesisUncertainty {
  if (hypotheses.length === 0) throw new Error("At least one hypothesis is required");
  const probabilities = hypotheses.map((hypothesis) => hypothesis.posterior ?? hypothesis.prior);
  const total = probabilities.reduce((sum, value) => sum + value, 0);
  if (!(total > 0) || !Number.isFinite(total)) throw new Error("Hypothesis probability mass must be positive");
  const normalized = probabilities.map((value) => value / total);
  const entropy = normalized.reduce((sum, probability) => {
    return probability > 0 ? sum - probability * Math.log2(probability) : sum;
  }, 0);
  const maxEntropy = Math.log2(hypotheses.length);
  const maxPosterior = Math.max(...normalized);
  return {
    entropy,
    normalizedEntropy: maxEntropy > 0 ? entropy / maxEntropy : 0,
    maxPosterior,
    effectiveHypothesisCount: 2 ** entropy,
  };
}

export function calculateEntropyReduction(
  before: RestorationHypothesis[],
  after: RestorationHypothesis[],
): number {
  const prior = calculateHypothesisUncertainty(before).entropy;
  const posterior = calculateHypothesisUncertainty(after).entropy;
  return prior - posterior;
}

export function calculateKullbackLeiblerDivergence(
  prior: RestorationHypothesis[],
  posterior: RestorationHypothesis[],
): number {
  if (prior.length !== posterior.length) throw new Error("Prior and posterior hypothesis sets must have equal length");
  const priorUncertainty = normalize(prior);
  const posteriorUncertainty = normalize(posterior);
  return posteriorUncertainty.reduce((sum, q, index) => {
    const p = priorUncertainty[index];
    if (q === 0) return sum;
    if (p === 0) throw new Error("KL divergence is undefined when posterior mass exists where prior mass is zero");
    return sum + q * Math.log2(q / p);
  }, 0);
}

function normalize(hypotheses: RestorationHypothesis[]): number[] {
  const values = hypotheses.map((hypothesis) => hypothesis.posterior ?? hypothesis.prior);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!(total > 0) || !Number.isFinite(total)) throw new Error("Hypothesis probability mass must be positive");
  return values.map((value) => value / total);
}

export interface BetaPrior {
  alpha: number;
  beta: number;
}

export interface BayesianEvidence {
  /** Evidence support for the hypothesis, bounded to [0, 1]. */
  support: number;
  /** Effective evidence weight. Zero is allowed and has no effect. */
  weight: number;
  /** Optional source reliability multiplier, bounded to [0, 1]. */
  reliability?: number;
}

export interface BayesianPosterior {
  alpha: number;
  beta: number;
  mean: number;
  variance: number;
  uncertainty: number;
  lowerBound: number;
  upperBound: number;
  /** True when bounds use the deterministic normal approximation below. */
  boundsAreApproximate: true;
}

const Z_95 = 1.959963984540054;

function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than 0`);
  }
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite number greater than or equal to 0`);
  }
}

function assertUnit(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a finite number in [0, 1]`);
  }
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function createBetaPrior(alpha = 1, beta = 1): BetaPrior {
  assertPositiveFinite(alpha, 'alpha');
  assertPositiveFinite(beta, 'beta');
  return { alpha, beta };
}

/**
 * Apply weighted evidence to a Beta belief.
 *
 * Evidence is treated as fractional pseudo-counts:
 *   alpha += effectiveWeight * support
 *   beta  += effectiveWeight * (1 - support)
 *
 * This is deliberately domain-neutral. Domains decide what a hypothesis means,
 * how priors are chosen, and when a posterior is strong enough to matter.
 */
export function updateBetaBelief(
  prior: BetaPrior,
  evidence: BayesianEvidence[],
): BayesianPosterior {
  assertPositiveFinite(prior.alpha, 'prior.alpha');
  assertPositiveFinite(prior.beta, 'prior.beta');

  let alpha = prior.alpha;
  let beta = prior.beta;

  for (const item of evidence) {
    assertUnit(item.support, 'evidence.support');
    assertNonNegativeFinite(item.weight, 'evidence.weight');
    const reliability = item.reliability ?? 1;
    assertUnit(reliability, 'evidence.reliability');

    const effectiveWeight = item.weight * reliability;
    alpha += effectiveWeight * item.support;
    beta += effectiveWeight * (1 - item.support);
  }

  return posteriorFromBeta({ alpha, beta });
}

export function posteriorFromBeta(posterior: BetaPrior): BayesianPosterior {
  assertPositiveFinite(posterior.alpha, 'posterior.alpha');
  assertPositiveFinite(posterior.beta, 'posterior.beta');

  const total = posterior.alpha + posterior.beta;
  const mean = posterior.alpha / total;
  const variance = (posterior.alpha * posterior.beta) / (total * total * (total + 1));
  const standardDeviation = Math.sqrt(variance);
  const margin = Z_95 * standardDeviation;

  return {
    alpha: posterior.alpha,
    beta: posterior.beta,
    mean,
    variance,
    uncertainty: standardDeviation,
    lowerBound: clampUnit(mean - margin),
    upperBound: clampUnit(mean + margin),
    boundsAreApproximate: true,
  };
}

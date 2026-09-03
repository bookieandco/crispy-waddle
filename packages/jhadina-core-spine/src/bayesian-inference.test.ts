import assert from 'node:assert/strict';
import { createBetaPrior, posteriorFromBeta, updateBetaBelief } from './bayesian-inference.js';

const close = (actual: number, expected: number, tolerance = 1e-12) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} !== ${expected}`);

{
  const prior = createBetaPrior();
  assert.deepEqual(prior, { alpha: 1, beta: 1 });

  const posterior = posteriorFromBeta(prior);
  close(posterior.mean, 0.5);
  assert.equal(posterior.boundsAreApproximate, true);
  assert.ok(posterior.lowerBound >= 0 && posterior.upperBound <= 1);
}

{
  const posterior = updateBetaBelief(createBetaPrior(), [
    { support: 1, weight: 3 },
  ]);
  close(posterior.alpha, 4);
  close(posterior.beta, 1);
  close(posterior.mean, 0.8);
}

{
  const posterior = updateBetaBelief(createBetaPrior(), [
    { support: 0, weight: 3 },
  ]);
  close(posterior.alpha, 1);
  close(posterior.beta, 4);
  close(posterior.mean, 0.2);
}

{
  const posterior = updateBetaBelief(createBetaPrior(), [
    { support: 1, weight: 2, reliability: 0.5 },
    { support: 0, weight: 2, reliability: 0.5 },
  ]);
  close(posterior.alpha, 2);
  close(posterior.beta, 2);
  close(posterior.mean, 0.5);
}

{
  const first = updateBetaBelief(createBetaPrior(2, 3), [
    { support: 0.75, weight: 4, reliability: 0.9 },
    { support: 0.25, weight: 1 },
  ]);
  const second = updateBetaBelief(createBetaPrior(2, 3), [
    { support: 0.75, weight: 4, reliability: 0.9 },
    { support: 0.25, weight: 1 },
  ]);
  assert.deepEqual(first, second);
  assert.ok(first.mean >= 0 && first.mean <= 1);
  assert.ok(first.lowerBound >= 0 && first.lowerBound <= first.mean);
  assert.ok(first.upperBound >= first.mean && first.upperBound <= 1);
  assert.ok(first.variance >= 0);
  assert.ok(first.uncertainty >= 0);
}

{
  assert.throws(() => createBetaPrior(0, 1), RangeError);
  assert.throws(() => createBetaPrior(1, -1), RangeError);
  assert.throws(
    () => updateBetaBelief(createBetaPrior(), [{ support: 1.1, weight: 1 }]),
    RangeError,
  );
  assert.throws(
    () => updateBetaBelief(createBetaPrior(), [{ support: 0.5, weight: -1 }]),
    RangeError,
  );
  assert.throws(
    () => updateBetaBelief(createBetaPrior(), [{ support: 0.5, weight: 1, reliability: 2 }]),
    RangeError,
  );
}

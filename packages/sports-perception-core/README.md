# @jhadina/sports-perception-core

First P0 sports foundation for Jhadina Director.

## Contract boundary

`PredictionRecord` is intelligence, not execution. A prediction is accepted only when:

- the prediction cutoff is valid;
- the feature snapshot is at or before the cutoff;
- every referenced evidence item was received by the cutoff;
- the probability distribution is finite, bounded, unique, and sums to 1;
- model/calibration/version/hash provenance is present.

`RealityState` is canonical only when explicitly validated and backed by source evidence.

## Learning boundary

Predictions are append-only. `InMemoryPredictionLedger` intentionally has no update/delete API. Production persistence should implement the same interface with an append-only database constraint.

Evaluation exposes multiclass Brier score and log loss, plus binary reliability buckets for calibration analysis. Historical predictions are never rewritten after outcomes arrive.

## Explicit non-goals

This package does not:

- place or authorize bets;
- call bookmaker/exchange execution APIs;
- infer world truth from an LLM;
- treat market observations as world evidence;
- overwrite historical predictions.

Financial side effects remain downstream of SHARK and Money Core governance.

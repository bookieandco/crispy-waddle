# SPORT-MONEY-01 — Sports Prediction Research Ingress

## Objective

Connect the canonical Sports Prediction envelope to Money Core without giving Sports Prediction any betting, allocation, order, payment, transfer, or execution authority.

This is a **one-way evidence boundary**:

```text
Coaching AI / Sports Prediction
        |
        | SPORT-PRED-01
        v
SPORT-MONEY-01 ingress
        |
        | validated research artifact
        v
Money Core DecisionCase
        |
        v
RESEARCH_ONLY
```

There is intentionally no reverse execution path.

## Producer compatibility

Money Core accepts only the versioned producer schema:

`SPORT-PRED-01`

An incompatible version fails closed. The repositories remain independently deployable; Money Core models the external wire contract rather than importing the Coaching AI package as a runtime dependency.

## Preserved intelligence

The bridge preserves:

- envelope identity;
- sport and prediction subject;
- point-in-time information cutoff;
- issue time;
- model, model version, methodology version, and feature snapshot hash;
- the complete outcome probability distribution;
- calibration state and Brier metadata;
- aleatoric, epistemic, and overall uncertainty;
- resolution authority and rule version;
- evidence lineage;
- source input/evidence hashes and generator provenance.

## Evidence conversion

Sports evidence is converted into Money Core `EvidenceRef` records only when every evidence item has an explicit `observedAt`.

The bridge refuses to invent an observation timestamp.

It also rejects sports evidence observed after the source envelope's information cutoff. This prevents post-event or future information from leaking into a historical prediction record.

Money Core records its own `receivedAt` when the envelope crosses the boundary.

## Decision boundary

Ingress creates a Money Core `DecisionCase` with:

`status = RESEARCH_ONLY`

and a `DecisionAssessment` with:

`disposition = RESEARCH_ONLY`

`authorityStatus = MISSING`

Risk, stress, simulation, liquidity, and freshness remain `UNEVALUATED` at ingress.

This is intentional: Sports Prediction does not get to pre-populate Money Core's financial risk or authority decisions.

## Execution invariant

A valid source envelope must state:

```text
decision           = INTELLIGENCE_ONLY
coachingExecution  = NONE
bettingExecution   = NONE
financialExecution = NONE
```

The resulting Money artifact additionally fixes:

```text
bettingAuthority   = NONE
financialAuthority = NONE
```

The existing Money Core `assertProposalEligible()` rejects the bridge-produced assessment because a research artifact is not proposal eligible and has no financial authority.

Therefore the bridge cannot directly create:

- an `OpportunityCandidate`;
- a capital allocation;
- a bet;
- a trade/order;
- an execution permit;
- a payment or transfer.

## Separation from prediction markets

A Sports Prediction envelope is **not automatically a `PREDICTION` asset**.

The bridge does not map a sports probability to a prediction-market instrument, sportsbook line, expected financial return, or wager. Any future market-specific opportunity must independently resolve a canonical instrument, market evidence, pricing, risk, policy, capital, and authority inside Money Core.

## Implementation

- `packages/money-core/src/sports-intelligence-ingress.ts`
- `packages/money-core/src/sports-intelligence-ingress.test.ts`
- exported through `packages/money-core/src/index.ts`

## Next

**MONEY-STOCK-01 — Stock Market Reality** should build the market-side state that complements the issuer/fundamental work already present:

`instrument → venue/session → quote/bar/book → corporate action → benchmark → point-in-time market snapshot → issuer/fundamental fusion`

SPORT-MONEY-01 should remain a narrow evidence adapter while that work proceeds.

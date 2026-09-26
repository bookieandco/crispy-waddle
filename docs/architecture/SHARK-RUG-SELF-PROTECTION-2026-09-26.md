# SHARK rug self-protection — 2026-09-26

Status: **implemented as research/paper/shadow protection; live execution authority unchanged**

## Goal

SHARK must protect the system from rug risk before entry **and** continue protecting an existing position after entry.

The architecture is deliberately asymmetric:

- deterministic evidence can block a candidate;
- missing critical evidence fails closed;
- calibrated ML/AI may increase caution;
- no ML/AI model can clear a deterministic blocker;
- SHARK cannot authorize a trade or an exit;
- Money Core remains the sole financial/execution authority.

## New implementation

- `packages/shark-intelligence-core/src/meme-trader/rug-self-protection.ts`
- `packages/shark-intelligence-core/src/meme-trader/__tests__/rug-self-protection.test.ts`
- assessment integration in `assessment.ts`
- integration coverage in `rug-assessment-integration.test.ts`

### Critical coverage required

A candidate cannot be treated as sufficiently understood unless the current evidence covers:

1. sellability;
2. liquidity control;
3. token/contract authority control;
4. holder independence;
5. operator identity / operator-cluster context.

Missing any critical family -> `QUARANTINE`.

### Result states

- `ALLOW_PAPER_STUDY`
- `CAUTION`
- `BLOCK_NEW_ENTRY`
- `EXIT_RECOMMENDED`
- `QUARANTINE`

All states remain `RESEARCH_ONLY`. `canAuthorizeTrade=false` and `canAuthorizeExit=false`.

## Runtime sentinel

The gate can consume point-in-time runtime observations after a candidate/position exists:

- liquidity removed;
- drawdown from peak;
- volume-spike factor;
- consecutive downward moves;
- time since peak;
- operator-linked distribution.

Paper defaults are versioned research thresholds, not production truth. Future live thresholds must be separately validated and admitted by Money governance.

## External reference audit

The following user-supplied repositories are now present in the governed reference-provenance registry.

### degenfrends/solana-rugchecker

Useful research concepts:
- Solana metadata analysis;
- top-holder analysis;
- liquidity analysis;
- detailed check result vs a single composite rug score.

Important limitation:
- upstream explicitly warns that results may fail or be false.

Adoption:
- methodology/reference only until source/license verification and local calibration;
- upstream score never clears Jhadina deterministic blockers.

### Solanacheker/rug-solana-checker-solscan

Useful research/UI concepts:
- metadata;
- LP status;
- ownership;
- launch behavior;
- wallet/token-flow review;
- social/website/volume context.

Adoption:
- workflow/UI reference only;
- README claims are not treated as verified detection performance.

### KeithTheDev/rugpulldetector

Useful research concepts:
- moving-window detection;
- drawdown from peak;
- volume spikes;
- consecutive price declines;
- time-from-peak context.

Adoption:
- feeds `RUG_RUNTIME_SENTINEL_V1`;
- upstream fixed thresholds are experiments, not production constants.

### kangmyoungseok/RugPull-Prediction-AI

Useful feature ideas:
- LP lock ratio and lock expiry;
- creator LP/token holdings;
- LP distribution statistics;
- mint/burn/swap cadence;
- buy/sell rates.

Domain limitation:
- historical Ethereum / Uniswap-v2 system;
- old model and labels are out-of-domain for Solana.

Adoption:
- feature hypothesis and red-team reference;
- model signal must remain `OUT_OF_DOMAIN` until retrained/recalibrated on Solana PIT data;
- out-of-domain model can never declare a Solana token safe.

### CRPWarner/RugPull

Useful threat taxonomy:
- hidden mint;
- limiting sell;
- token leakage;
- dumping;
- liquidity withdrawal;
- project abandonment.

Domain limitation:
- Solidity/EVM bytecode/static-analysis framework.

Adoption:
- EVM threat detector reference;
- Solana uses analogous chain-native authority/transfer/liquidity controls rather than pretending EVM bytecode logic applies directly.

### dianxiang-sun/rug_pull_dataset

Useful research asset:
- historical validated ETH/BSC rug incidents;
- rug type/root-cause/source/loss taxonomy.

Domain limitation:
- historical cross-chain incident corpus, not a Solana oracle.

Adoption:
- replay/red-team corpus with chain, time and taxonomy provenance;
- useful for “did our taxonomy catch this failure?” testing;
- not direct Solana training data without domain-shift controls.

## Three-layer self-protection

### Layer A — pre-entry structural defense

Existing `rug-protection.ts` plus the new self-protection wrapper evaluates:

- transfer/sell restrictions;
- freeze/mint/mutable-balance controls;
- LP burn/lock/control;
- liquidity history and drain;
- holder concentration;
- supply/operator control;
- market-integrity disagreement.

The chat-derived forensics extend research toward:
- operator-cluster supply rather than visible dev wallet only;
- funder ancestry;
- holder uniformity;
- bundled/copy-cluster separation;
- effective holder count;
- synthetic vs independent volume;
- metadata/identity collision;
- creator/operator history.

### Layer B — runtime position defense

Even a clean pre-entry check can become unsafe later.

The runtime sentinel therefore keeps watching for:
- LP removal;
- liquidity-control changes;
- operator-linked distribution;
- abrupt collapse pattern;
- authority/control change;
- new evidence that changes holder/operator independence.

A severe runtime state blocks new adds and produces `EXIT_RECOMMENDED` for paper/shadow. Future live handling remains a Money policy decision.

### Layer C — bot/account defense

For any future autonomous live deployment:

- paper is the default mode;
- live trading requires a separately approved Money mandate;
- credentials must be trade-only where provider capability permits;
- withdrawal permission must not be granted to the bot;
- provider/account entitlements remain capability-scoped;
- hard max order, daily notional, daily realized loss, gross exposure, drawdown and leverage limits stay outside model control;
- unresolved execution outcomes block further execution;
- production canary limits remain active;
- provider/data degradation fails closed;
- IP allowlisting / isolated subaccounts should be used where supported;
- no model can widen its own mandate or risk limits.

This aligns with the existing Money autonomous-trading architecture rather than creating a SHARK wallet/execution path.

## Paper-study objectives

The system should study both accepted **and rejected** candidates.

Required metrics:

- rug recall;
- false-safe rate;
- false-veto rate;
- time-to-detection;
- detection-before-loss vs detection-after-collapse;
- LP-removal detection;
- operator-distribution detection;
- holder-cluster contribution;
- synthetic-volume contribution;
- model incremental value over deterministic rules;
- result by lifecycle stage, chain, launchpad and regime.

The primary safety metric is **false-safe rate**, not headline trade count.

## Model-admission rule

For a rug model to become more than research context it must demonstrate, on point-in-time Solana data:

1. out-of-sample calibration;
2. low false-safe rate;
3. no lookahead leakage;
4. performance by launchpad/regime;
5. incremental value beyond deterministic controls;
6. stability under threshold perturbation;
7. paper replication;
8. shadow replication.

Even after admission, model output remains a **risk escalation input**, not a mechanism for clearing a deterministic veto.

## Future Money binding

A future live meme strategy must satisfy both:

```
SHARK rug defense -> no quarantine/block
AND
Money autonomous risk -> mandate + hard limits + entitlement + preflight + permit
```

Neither layer can override the other.

This is the canonical self-protection design for SHARK meme trading and the pattern to reuse for other markets: domain-specific hazard detectors feed a generic Money risk/authority boundary.

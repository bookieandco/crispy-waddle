# MEME-AUTO canonical audit and extension plan — 2026-10-03

Status: **deep source/repo/handoff reconciliation complete; production closed loop not yet certified**

This document reconciles the current conversation with the prior SHARK/Money handoffs, current repository implementation, GitHub references, source transcripts, Social Core and the current production scheduler.

It does not create a second trading authority or silently convert source claims into production truth.

## 1. Canonical architecture

```
market / chain / launchpad / Telegram / X / Reddit evidence
  -> normalization + provenance + deduplication
  -> SHARK discovery / wallet / actor / narrative / forensic intelligence
  -> MemeTradeAssessment / DecisionProposal
  -> SHARK-MONEY governed research envelope
  -> Money Core paper / shadow / risk / execution authority
  -> Coffer / governed signer only when separately commissioned
  -> outcome evidence
  -> SHARK + Money learning
```

Hard boundaries:

- SHARK has no wallet signing, broadcast or capital authority.
- Social/Telegram/X/Reddit signals are evidence, never direct execution commands.
- Rug/manipulation/identity/independence vetoes dominate alpha.
- Paper P&L and shadow executable P&L are separate evidence classes.
- `NO_TRADE` is a valid terminal result.
- Strategies cannot promote themselves.
- unrestricted live meme execution remains separately governed and is not enabled by this fold.

## 2. What is actually implemented today

### SHARK core — implemented

Current source materially contains:

- Pump launch ingestion and Pump 2 feature normalization;
- PumpSwap and Raydium liquidity decoding;
- migration classification and migration-aware risk;
- wallet/entity graphs and actor reputation;
- wallet cluster calibration;
- sniper candidate logic;
- rug self-protection and deterministic defensive vetoes;
- external signal ingestion for Telegram/Discord/X and, in this branch, Reddit;
- copy-trade observation telemetry without copy authority;
- source/research provenance and source-family independence;
- scalp/candidate strategy registry;
- position review and post-exit learning;
- SHARK -> Money research-only bridge.

### Money core — implemented

Current source materially contains:

- canonical paper-learning contracts;
- paper realism and autopilot controls;
- shadow market observation and paper-vs-live comparison;
- DEX readiness/canary/permit/signing boundaries;
- position management;
- controlled execution contracts;
- durable trade event types and memory contracts.

### Application/runtime — incomplete

Current repository search still shows no canonical application caller for:

- `createPersistedActorAwareMemeTradeAssessment()`;
- `buildSniperCandidate()`;
- `compareShadowExecution()` for meme candidates;
- `createDurableTradeRuntime()` in the production app.

Therefore these are **implemented core / runtime unwired**, not production-automatic features.

The current Money paper-autopilot worker is still a stock SMA/Alpaca worker. It does not implement autonomous memecoin paper trading.

## 3. Production scheduler drift found and repaired

Two protected SHARK scheduler routes authenticated GitHub OIDC but then created the generic privileged Supabase client:

- `/api/internal/shark/launch-outcomes`;
- `/api/internal/shark/historical-observations`.

That path could fail when no long-lived service-role key is present because the generic fallback expects Vercel OIDC rather than the incoming GitHub scheduler identity.

This branch changes those routes to:

```
authorizedSchedulerRequest(request)
  -> createSchedulerServiceRoleClient(request)
```

The Money paper route had the same architectural mismatch: it authenticated the scheduler, but `runMoneyPaperAutopilotCycle()` independently created the generic client.

This branch now allows the worker to accept an injected Supabase client and injects the scheduler-specific client from the route.

This is an authentication/transport repair only. It does **not** convert the stock paper worker into a meme worker.

## 4. Pump.fun -> PumpSwap migration intelligence

### Pump-specific migration verifier added

`packages/shark-intelligence-core/src/meme-trader/pump-migration-verifier.ts` now encodes the current published interface boundary.

Verification requires:

- Pump program ID;
- recognized `migrate` or `migrate_v2` discriminator;
- completed bonding curve;
- canonical PumpSwap program;
- canonical pool index;
- matching base mint;
- matching quote mint when present;
- independently verified canonical-pool creator semantics;
- immutable evidence IDs.

A completed curve or observed pool address alone cannot create verified migration evidence.

The verifier converts a successful Pump migration into the existing generic `TokenMigrationEvidence` contract so migration-aware LP/rug handling keeps one canonical downstream model.

### Existing pieces

The repository already contains:

- Pump/PumpSwap program awareness;
- Pump launch state features;
- pool discovery;
- PumpSwap liquidity decoding;
- migration classification;
- migration-aware actor/rug handling;
- post-migration strategy hypotheses.

### Missing piece before this branch

There was no canonical point-in-time **pre-graduation radar** that followed a mint from active bonding curve through completion into canonical PumpSwap migration.

### Added in this branch

`packages/shark-intelligence-core/src/meme-trader/migration-radar.ts`

Lifecycle:

```
DISCOVERED
 -> APPROACHING_GRADUATION
 -> CURVE_COMPLETE
 -> PUMPSWAP_MIGRATED
```

The radar can use:

- real bonding-curve reserve progress;
- holder count;
- unique buyer count;
- holder growth;
- volume acceleration;
- buy pressure;
- creator risk;
- wallet/cluster risk;
- sniper inventory risk;
- deterministic rug block;
- observed PumpSwap pool.

It fails closed:

- missing canonical safety checks -> `REVIEW`;
- defensive blocker -> `BLOCK`;
- only a fully checked high-scoring candidate can become `WATCH`.

The output remains:

```
authority = RESEARCH_ONLY
canAuthorizeTrade = false
```

## 4A. Current Pump protocol details that affect the build

Current Pump documentation says graduation closes the bonding curve and migrates liquidity to the canonical PumpSwap pool. The implementation must therefore treat curve completion and verified PumpSwap pool readiness as two related but distinct observations.

The migration radar now refuses to label a candidate `PUMPSWAP_MIGRATED` from a pool address alone; the PumpSwap pool must be separately verified.

Do not hard-code SOL as the only quote asset. Pump currently supports additional paired assets, including USDC, so the candidate/paper/shadow path must preserve `quoteMint` and calculate fees/price impact in the actual quote asset.

Mayhem Mode must be a separate research regime. Current Pump documentation describes first-day automated trading behavior and altered token supply for Mayhem-enabled launches. The repo already records `mayhemMode` in Pump launch features; this branch carries that regime through migration-radar candidates and adds `PUMP_MAYHEM_REGIME_V1` so ordinary-launch statistics are not contaminated by Mayhem flow.

## 5. RocketScan fold

RocketScan is useful as a product/discovery reference because it emphasizes the operational question the user cares about:

- which Pump.fun tokens are approaching bond/graduation;
- which have already migrated;
- which have enough holders/volume/age/market-cap characteristics to deserve attention;
- which pools are becoming relevant.

Jhadina should reproduce those useful discovery concepts from canonical on-chain/provider evidence rather than depending on RocketScan's score as truth.

Canonical fold:

```
RocketScan-style lifecycle board
  + exact Pump curve progress
  + exact PumpSwap migration
  + holder/buyer independence
  + developer history
  + wallet clusters
  + sniper inventory
  + rug protection
  + social/catalyst evidence
  = SHARK migration candidate
```

The token-directional thesis and LP thesis must be attributed separately. Price appreciation, LP fees, IL/LVR, range placement and rebalance costs cannot be merged into one "return" number.

## 6. GitHub reference reconciliation

### harutocodes/pumpfun-copytrade

Pinned source revision:
`a3b5f17550c4a19e429153433585a3cb3ca5714d`

License:
MIT.

Useful concepts:

- Solana websocket observation of fills;
- Pump.fun event decoding;
- PumpSwap pool-to-mint normalization;
- separation between observation and execution interfaces.

Not adopted:

- desktop wallet custody;
- raw private-key execution;
- live copy-trade authority;
- source profitability claims.

### SmithiiDev/smithii-sdk-skill

Pinned source revision:
`37870f6b9eb75600905fd127aeeae9b9a722a940`

License:
MIT.

Useful concepts:

- Pump/PumpSwap route semantics;
- Jito/bundle constraints as execution-research inputs.

Not adopted:

- raw private-key arrays;
- vendor-backend custody/orchestration of protected funds;
- artificial-volume/manipulative execution as an alpha feature;
- bypasses around Money/Coffer authority.

### RocketScan

Registered as a UI/data-source inspiration only.

Useful concepts:

- launch lifecycle board;
- market-cap/age/holder/volume filters;
- migrated/not-migrated state;
- pool alerts.

No RocketScan scoring or marketing claim gains factual or execution authority.

## 7. Telegram + X + Reddit intelligence

### Existing Telegram/X SHARK core

`external-signal-ingest.ts` already extracts:

- Solana addresses;
- Solscan transaction links;
- DexScreener Solana links;
- Birdeye token links.

It emits evidence-only observations and research-only hypotheses.

### Reddit support added

The external-signal platform contract now includes:

`REDDIT`.

### Social Core reuse

Social Core already models:

- X;
- Reddit;
- trend observations;
- provider/account/source identity;
- evidence;
- metrics;
- attributes.

The Ayrshare provider descriptor already advertises X and Reddit platform support.

Instead of creating SHARK-specific scrapers, this branch adds:

`apps/jhadina-web/src/lib/shark/social-signal-bridge.ts`

That bridge maps governed X/Reddit `SocialObservation` objects into SHARK's external-signal contract.

The bridge itself:

- never reads providers directly;
- never publishes;
- never creates financial authority;
- returns only evidence-level SHARK observations.

### Source outcome learning

New core:

`external-signal-source-learning.ts`

Per exact source/channel identity it can learn:

- sample size;
- migration hit rate;
- rug rate;
- independent-discovery rate;
- median lead time;
- median executable return;
- positive executable-return rate.

Results remain:

```
authority = LEARNING_ONLY
canAuthorizeTrade = false
canAutoCopy = false
```

### Cross-platform fusion rule

Telegram, X and Reddit should be fused only after provenance/deduplication.

A tweet copied into Telegram and reposted on Reddit is **one source family**, not three independent confirmations.

The canonical social path is:

```
Telegram selected chats/channels
X selected accounts/searches
Reddit selected subreddits/posts
           ↓
normalize
           ↓
source-family / repost / common-origin dedup
           ↓
token + wallet + link + narrative + catalyst extraction
           ↓
on-chain verification
           ↓
SHARK candidate / source ledger
```

## 8. Transcript strategy fold

The current imported candidate registry now contains nine candidate strategies:

- `NEW_PAIR_POST_BUNDLE_DIP`;
- `FINAL_STRETCH_FLOOR_RECLAIM`;
- `FINAL_STRETCH_40_50_DIP`;
- `TRACKED_DEV_CONSOLIDATION`;
- `MIGRATED_POST_NUKE_CONSOLIDATION`;
- `EARLY_GAINER_TREND_CONFIRMATION`;
- `PUMPFUN_SOCIAL_FLOW_CONFIRMATION`;
- `DEV_HISTORY_CATALYST_CONTINUATION`;
- `META_DERIVATIVE_ROTATION`.

All remain `CANDIDATE`.

Behavioral/defensive folds include:

- `BOREDOM_ENTRY_GUARD_V1`;
- `NARRATIVE_VOLUME_DECAY_EXIT_V1`;
- creator/operator history;
- bundle/sniper inventory;
- copy-cluster concentration;
- source promotion conflicts;
- holder independence;
- liquidity/rug vetoes.

Source-reported challenge returns are not treated as validated performance.


## 8A. Bloom / FNF / Soul Pump transcript fold

Three additional user-supplied transcripts sharpen the social-sniper/caller side of MEME-AUTO.

### Bloom-style social/dev sniping

Useful concepts:

- one event-trigger layer for Telegram, X, Discord and developer-wallet launches;
- allowlisted developer identities;
- exact name/ticker triggers as a narrow discovery condition;
- creator-buy lower/upper bounds;
- prior/recent token-creation count as a creator-behavior feature;
- measured post/CA publication -> SHARK availability -> executable quote latency;
- slippage, fee/tip and MEV claims treated as execution-research inputs, not trusted defaults.

Implemented from this fold:

- `creator-launch-trigger.ts` — fail-closed discovery-only filter for creator wallet, exact name/ticker, launchpad, creator-buy bounds and recent-token count;
- `SOCIAL_CA_LATENCY_BENCH_V1` — shadow latency experiment;
- `CREATOR_LAUNCH_TRIGGER_FILTER_V1` — paper-only creator-trigger experiment.

The filter output can be `MATCH`, `REVIEW` or `REJECT`, but always carries `canAuthorizeTrade=false`.

### Copy-trader reflexivity defense

The Bloom transcript warns that a heavily followed wallet can make repeated small buys after its initial entry, causing copy traders to continue buying.

SHARK must not infer intent or accuse a wallet of farming from that pattern alone. Instead, it now has a defensive observable:

`assessCopyTradeReflexivity()`

It measures:

- repeated buys by the same wallet/token;
- rapid repeat buys;
- materially smaller repeat buys after the initial entry;
- total repeat pressure.

The output is `LOW / CAUTION / HIGH` defensive evidence only. It cannot auto-copy or authorize a trade.

### FNF / caller-network dependence

The networking transcript reinforces a critical provenance issue: multiple call channels can be socially connected, share members, share information, repost the same call, or be downstream of one original source.

Therefore:

```
5 channels repeating one source != 5 independent confirmations
```

New module:

- `CALLER_NETWORK_DEPENDENCE_V1`.

New core:

- `external-signal-independence.ts`.

It collapses sources that share a source family, upstream origin or identical content fingerprint before calculating independent evidence count.

Claims of private/inside access, shooter fees, refunds, affiliate incentives or undisclosed promotion are treated as provenance/conflict-risk evidence. They do not become positive alpha merely because the source claims exclusivity.

### Soul Pump-style caller analytics

Useful concepts:

- exact call timestamp;
- call market cap;
- first-caller ordering;
- per-channel call history;
- lifecycle/new/about-to-graduate/graduated filtering;
- channel/list grouping;
- source-specific entry/exit policy experiments.

A raw source-defined win rate such as "2x at any point after the call" is not sufficient evidence of executable edge.

The external-source outcome ledger now additionally records/aggregates:

- execution latency;
- market cap at the call;
- maximum favorable excursion;
- maximum adverse excursion;
- executable return;
- executable 2x rate;
- first-independent-caller rate;
- tail-winner dependence.

This allows `CALLER_PERFORMANCE_LEDGER_V2`, `CALLER_RANK_EXP_1`, `CALL_IMPACT_DECAY_V1` and `SOURCE_POLICY_LEARNER_V1` to be tested against actual execution-aware outcomes instead of ATH screenshots.

### Canonical social/caller path

```
Telegram / X / Discord / Reddit / dev-wallet event
          ↓
external signal ingest
          ↓
source-family + cross-post independence
          ↓
creator / caller / wallet identity
          ↓
copy-reflexivity + promotion-conflict checks
          ↓
token / wallet / link / catalyst extraction
          ↓
on-chain verification
          ↓
SHARK assessment + migration radar
          ↓
Money paper/shadow policy experiment
          ↓
source/caller outcome ledger
```

No social source, caller ranking, exact-name trigger or developer-wallet match bypasses rug, cluster, liquidity, Money or execution-quality gates.



## 8B. Onchain trading blueprint part 1 fold

The additional user-supplied educational transcript is useful as a **defensive observation checklist**, not as a source of trusted numeric thresholds.

### Adopted observables

- liquidity depth and liquidity-control evidence;
- developer/operator launch history;
- holder concentration and holder independence;
- common funding and multi-wallet clustering;
- first/early transaction structure;
- repeated buy-size patterns;
- overly regular transaction timing;
- mirrored buy/sell behavior;
- fee-to-volume ratio as a venue-specific research feature;
- volume-to-liquidity ratio as a venue-specific research feature;
- mint/freeze/balance mutability controls;
- social/narrative attention only after on-chain verification;
- small-loss / survival-oriented paper-risk discipline.

Existing SHARK modules already cover:

- developer/entity history in `wallet-launch-pipeline.ts`;
- mint/freeze/balance mutability and holder concentration in `rug-protection.ts`;
- holder/operator independence in `rug-self-protection.ts`;
- funder diversity, holder uniformity and actor clusters in the research corpus.

New from this fold:

- `synthetic-volume-diagnostics.ts`;
- `SYNTHETIC_VOLUME_DIAGNOSTICS_V1`.

### Numeric-claim handling

The transcript gives multiple fee/volume examples that are not mutually consistent and may differ by venue/fee schedule.

Therefore Jhadina does **not** encode a universal rule such as:

```
fee/volume < X => fake volume
volume/liquidity > Y => fake volume
single holder > Z => unsafe
```

Instead, the diagnostics compute the raw ratios and structural features. Thresholds are optional, versioned paper/shadow calibration inputs.

Even when a calibrated threshold fires:

- it is a forensic flag, not proof of intent;
- it cannot label a person or wallet as a wash trader;
- it cannot authorize a trade;
- it can only raise review/risk context.

### Market-integrity correction

This fold also exposed a pre-existing risk-direction error in `assessment.ts`: a higher `anomalyScore` previously reduced the market-integrity risk component because it was inverted as `1 - anomalyScore`.

The assessment now treats `anomalyScore` as a risk signal directly in:

- the core risk vector;
- rug-protection market-integrity risk;
- migration-aware rug-protection evaluation.

A regression test requires higher anomaly evidence to produce higher market-integrity and overall risk.


## 9. Canonical migration strategy league

The next paper/shadow experiment set should compare:

- `MIGRATION_ZERO` — first executable PumpSwap opportunity;
- `MIGRATION_CONFIRM` — independent post-migration flow confirmation;
- `MIGRATION_DIP_1` — first qualified post-migration retracement;
- `SMART_WALLET_CONFIRM` — independent historically useful actor confirmation;
- `DEV_HISTORY` — verified developer/operator history;
- `VOLUME_ACCEL` — independent volume acceleration;
- `ANTI_BUNDLE` — wait for concentrated early inventory to reduce;
- `NARRATIVE_MIGRATION` — verified catalyst/narrative plus migration;
- `SOCIAL_CONFIRM` — deduplicated Telegram/X/Reddit corroboration;
- `COPY_CLUSTER_FADE` — penalize crowded follower flow;
- `NO_TRADE` — explicit control arm.

For each candidate, record:

- information cutoff;
- decision slot/time;
- first executable route;
- +1/+2/+N slot counterfactuals;
- quoted and realized/slippage-model price;
- route/priority/fee cost;
- quote expiry/failure;
- maximum adverse excursion;
- maximum favorable excursion;
- exit liquidity;
- migration outcome;
- rug/failed-launch outcome;
- source/caller attribution.

## 10. Remaining production gaps

### MEME-AUTO.2 — exact Pump lifecycle observer

Build one continuous provider adapter that follows a mint from bonding-curve state through completion into canonical PumpSwap pool creation.

The provider adapter supplies evidence only; scoring stays in `migration-radar.ts`.

### MEME-AUTO.3 — canonical meme assessment worker

Wire `createPersistedActorAwareMemeTradeAssessment()` into one application worker that loads:

- launch;
- actor history/edges;
- wallet clusters;
- migration state;
- market/liquidity evidence;
- rug self-protection;
- social/Telegram/X/Reddit evidence;
- strategy candidates.

Persist one canonical assessment/DecisionProposal.

### MEME-AUTO.4 — sniper orchestration

Wire `buildSniperCandidate()` into the same candidate pipeline.

Do not create a second standalone sniper authority.

### MEME-AUTO.5 — external intelligence adapters

Telegram:
- authorized user-session/selected-message adapter;
- explicit chat/channel allowlist.

X:
- selected accounts/searches/lists;
- provider-backed read/listen ingest into Social Core.

Reddit:
- selected subreddits/searches/posts/comments;
- provider-backed read/listen ingest into Social Core.

The current Ayrshare adapter only implements connected-profile discovery, publishing, publication history and deletion. Its capability metadata must not be mistaken for a commissioned arbitrary-feed listener. X/Reddit intelligence is therefore connected **Social Core -> SHARK** at the internal boundary in this branch, while live external read/listen collection remains to be built/certified.

All feed the common SHARK bridge.

### MEME-AUTO.6 — memecoin paper execution

Build a separate Money-owned memecoin paper worker.

It should understand:

- Pump bonding-curve quotes before completion;
- PumpSwap quotes after migration;
- stage-aware fees/slippage;
- partial exits;
- failed/expired quotes;
- position monitoring.

It must not reuse Alpaca stock assumptions.

### MEME-AUTO.7 — shadow execution

Use Money's existing shadow engine against live read-only Solana/DEX quotes.

Compare paper assumptions to executable reality without submitting transactions.

### MEME-AUTO.8 — outcome/source learning

Close the loop into:

- developer reputation;
- cluster reputation;
- sniper inventory outcomes;
- strategy attribution;
- Telegram/X/Reddit source ledger;
- migration strategy league;
- regime attribution.

### MEME-AUTO.9 — durable runtime

Instantiate `createDurableTradeRuntime()` in the application composition root for paper/shadow meme sessions.

The existing core is not evidence that production instantiation already exists.

### MEME-AUTO.10 — health, scheduler and receipts

Add scheduler jobs and production health for:

- migration observer;
- candidate assessment;
- memecoin paper cycle;
- memecoin shadow cycle;
- source/outcome learning.

Every worker must use scheduler-specific privileged transport and emit durable receipts.

## 11. Promotion gate

Required lifecycle remains:

```
SOURCE_HYPOTHESIS
 -> HISTORICAL_REPLAY
 -> OUT_OF_SAMPLE
 -> PAPER
 -> SHADOW
 -> REGIME_REPLICATION
 -> LIMITED_CAPITAL_ELIGIBLE
 -> MONEY_CORE_REVIEW
```

No transcript, Telegram channel, X account, Reddit community, developer reputation, wallet reputation, migration score or backtest may skip that ladder.

## 12. Immediate canonical build order

```
MEME-AUTO.1  scheduler privileged-transport repair       [implemented in branch]
MEME-AUTO.2  Pump lifecycle observer                      [in progress: curve RPC + PDA derivation implemented]
MEME-AUTO.3  canonical actor-aware assessment worker      [implemented core + durable assessment evidence; scheduler/provider assembly next]
MEME-AUTO.4  sniper + rug + cluster orchestration
MEME-AUTO.5  Telegram/X/Reddit/Discord + caller-source provider ingestion
MEME-AUTO.6  dual-venue Pump/PumpSwap paper engine
MEME-AUTO.7  live read-only shadow execution
MEME-AUTO.8  source/developer/wallet/strategy learning
MEME-AUTO.9  durable event-runtime instantiation
MEME-AUTO.10 scheduler/health/receipts
MEME-AUTO.FINAL production paper/shadow certification
```

Unrestricted live capital remains outside this certification.

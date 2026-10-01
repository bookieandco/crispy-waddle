# VENTURE-LIVE runtime completion

Date: 2026-10-01  
Repository: `bookieandco/crispy-waddle`

## Purpose

This phase finishes the nonvisual runtime between the already-merged Venture Factory domain model and the future spatial HQ.

The visual layer remains deferred until runtime state is real enough to deserve animation.

## Runtime now implemented

### VENTURE-LIVE.1 — Runtime receipts

Venture work now produces typed receipts for:

- market scans;
- venture snapshots;
- experiment proposals;
- experiment observations;
- commercial outcomes;
- supervisor repairs;
- spatial runtime projections;
- memory commits;
- lifecycle transitions.

Every receipt carries:

`authorizationEffect = NONE`

A runtime receipt is evidence, never permission.

### VENTURE-LIVE.2 — Scout batches

Scout observations are normalized as read-only `VentureScoutBatch` records.

They include:

- scout identity;
- source;
- captured timestamp;
- normalized market signals;
- evidence references;
- `externalMutationPerformed=false`.

Signals are merged deterministically and deduplicated by signal ID.

### VENTURE-LIVE.3 — Supervisor runtime

The runtime can execute the existing supervisor assessment against real work-item state.

Detected issues remain recommendations.

A repair does not count as proven until a distinct `supervisor_repair` receipt is recorded with evidence.

### VENTURE-LIVE.4 — Spatial proof

The runtime can project rooms, agents, workflows and work items through the existing Venture HQ domain.

A spatial receipt records the factual counts and ledger state used by the future visual client.

The invariant remains:

`PROJECT_PROVABLE_RUNTIME_STATE_ONLY`

### VENTURE-LIVE.5 — Live-evidence derivation

`VENTURE-FACTORY.FINAL` live inputs are now derived from runtime state instead of manually supplied counters.

The runtime counts:

- distinct market signals;
- actual experiment receipts;
- realized commercial outcome receipts;
- supervisor repair receipts;
- spatial runtime receipts;
- originality status.

### VENTURE-LIVE.6 — Canonical persistence

No new competing Venture database authority was introduced.

The complete Venture runtime snapshot is persisted inside the canonical Opportunity payload metadata under:

`ventureFactoryRuntime`

This means canonical Opportunity persistence remains authoritative for the venture identity/state.

### VENTURE-LIVE.7 — Existing experiment authority reused

Venture validation does not create a parallel experiment engine.

The runtime calls the existing:

- `proposeSideHustleExperiment`;
- `createSideHustleExperiment`;
- canonical Side Hustle experiment persistence.

Therefore Venture Factory experimentation uses the same evidence, spend, duration, observation, maturity and approval contracts already used by Business Factory.

### VENTURE-LIVE.8 — Scout cycle

`runAndPersistVentureScoutCycle` executes registered read-only scouts, merges evidence-backed signals and persists the resulting canonical state.

Market scouts may observe.

They may not:

- publish;
- message sellers;
- purchase products;
- change listings;
- clone files;
- mutate marketplace accounts.

### VENTURE-LIVE.9 — Commercial outcome receipt

Realized commercial evidence can be attached to the Venture runtime using a canonical external outcome reference such as an order/payment/outcome receipt.

Recording a commercial outcome does not itself create revenue or move money.

### VENTURE-LIVE.10 — Authenticated Venture API

`/api/opportunities/[id]/venture`

supports authenticated:

- runtime initialization;
- validation experiment creation;
- supervisor scans;
- repair recording;
- spatial-runtime proof recording;
- commercial-outcome attachment.

### VENTURE-LIVE.11 — Scout registry

Market adapters now have a bounded registry.

Every registered scout declares:

- source kind;
- enabled state;
- maximum signals per run;
- maximum runtime;
- read-only contract.

The registry is the seam where Etsy-like marketplaces, search trends, social trends, digital asset markets, creator marketplaces, affiliate ecosystems, software markets and other legitimate data sources can be attached.

Actual provider adapters must preserve each source's API/access rules and produce provenance-backed market signals.

## Remaining nonvisual live work

The core/runtime software is complete enough to run once source adapters exist.

External/live evidence still requires:

1. connect at least one legitimate market-data scout adapter;
2. run a real discovery cycle;
3. persist three genuine market signals;
4. create and execute one bounded validation experiment;
5. capture one realized commercial outcome;
6. force or encounter one supervisor-repair case and record the repair receipt;
7. record one real spatial-runtime snapshot from the same underlying state;
8. run `VENTURE-FACTORY.FINAL` against those receipts.

These are live/provider evidence tasks, not missing domain architecture.

## Deferred visual brief

Do **not** implement this visual during the runtime phase.

When the spatial client is built, preserve this creative direction:

### Janet, Delia and Marisa offices

- **Janet** gets a Memory / Context office.
- **Delia** gets a Strategy / Intelligence office.
- **Marisa** gets an Operations / Execution office.
- Jhadina has the central executive command layer joining them.

Their office screens must display only real runtime state.

### Code Kitchen

A major production room should be a playful anime-inspired kitchen full of cute adult coder characters "cooking up code."

The joke is intentionally a transformation of the stereotypical drug-lab visual language into software production:

- code instead of drugs;
- laptops, terminals, servers, circuit boards and deploy trays instead of contraband;
- recipes as workflow specs;
- ingredients as source/evidence/context;
- ovens/stoves as build/test/render workers;
- finished dishes as certified artifacts landing in the outbox.

The characters should be clearly adult stylized workers, not sexualized minors.

This kitchen is a visual metaphor only. Its state must come from actual Builder/agent tasks, test results, queues, outputs and receipts.

## Completion boundary

At the end of this phase:

**Software/runtime:** implemented.

**Real marketplace/provider scout adapters:** still need live connection.

**Real commercial validation:** still needs genuine market activity.

**Spatial/anime visual client:** deliberately deferred until after runtime/live source wiring.

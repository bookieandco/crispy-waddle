# VENTURE-FACTORY — Jhadina autonomous venture operating system

Date: 2026-10-01  
Repository: `bookieandco/crispy-waddle`

## Decision

Venture Factory is not a second Opportunity engine or a second Side Hustle system.

It is the **Venture Lab inside the Side Hustle Business Factory**: the governed private-market discovery, research, originality, bounded-validation, supervision, and learning layer inside the existing Opportunity / Side Hustle architecture. Opportunity Core remains the canonical authority for opportunity identity, evidence, bounded validation, maturity, outcomes, provider/commercial links, and higher-level certification.

Execution remains with the owning domains:

- POD / personalized commerce -> PupsonStuff / Commerce
- media / thumbnails / game assets -> Director / Media / Growth
- software prototypes -> Builder
- owned media / affiliate -> Growth / Media / Commerce
- procurement / subcontracting -> Opportunity / SAM / Local Government
- music businesses -> Music / Growth
- financial/trading intelligence -> Money Core
- treasury / actual money movement -> Coffer / governed finance authority

Venture Factory can discover, score, propose, supervise, learn, prioritize, and project state. It does not acquire a new bypass for spending, publishing, outreach, fulfillment purchases, bidding, trading, withdrawals, deposits, or other consequential actions.

## Side Hustle fold

Canonical ownership is:

`Opportunity Core -> Side Hustle Business Factory -> Venture Lab -> Side Hustle Experiment -> Outcome Learning -> Side Hustle Maturity`.

The Venture Lab may use its internal lifecycle:

`discovered -> researched -> validated -> prototyped -> shadow -> launched -> optimizing -> scaling`

to describe the state of a particular venture hypothesis.

That lifecycle does **not** replace the canonical Side Hustle automation maturity ladder:

`unvalidated -> human_delivered -> ai_assisted -> workflow_automated -> exception_managed -> autonomous_cell`.

A Venture-discovered candidate becomes a canonical Side Hustle Opportunity before validation. It receives the registered family profile, Hub category, execution owners, monetization models, and `unvalidated` maturity. Its discovery provenance records `origin=venture_factory`, but authority remains `OPPORTUNITY_ONLY`.

The practical meaning is:

- **Side Hustle Business Factory** owns the business portfolio and maturation;
- **Venture Lab** finds and attacks hypotheses;
- **Experiment Engine** proves or disproves them;
- **owning domains** deliver them;
- **Outcome Learning** records economic truth;
- **maturity promotion** is earned from repeat evidence;
- **Spatial HQ** visualizes those same facts later.

### Research approval handoff

A research-ready Venture candidate may be adopted into the owner's Side Hustle Opportunity queue automatically under the configured discovery policy, but it does not begin research until the canonical Opportunity research approval occurs.

That approval now binds the Venture Lab directly into the canonical pursuit case by requiring:

- demand-thesis assessment;
- MAKE IT MAKE SENSE assessment;
- originality / IP assessment.

The persisted discovery stage advances from `research_candidate` to `researching`, and a `ventureLabResearchIntake` receipt records the canonical research case and the invariant `authority=RESEARCH_ONLY`.

Research approval does not authorize launch, publishing, outreach, purchases, spend, experiments, or money movement.

## Product law

The spatial "AI-agent game" is an operations interface, not a fake simulation.

A room, desk, agent, belt/workflow line, crate/outbox, lamp/status, spend counter, or completed product may only represent runtime state backed by evidence the system can produce.

The UI law is:

`PROJECT_PROVABLE_RUNTIME_STATE_ONLY`

No fake revenue.  
No fake completed work.  
No fake agent activity.  
No fake spend.  
No animation that implies a consequential action happened when the owning subsystem has no receipt.

## StarNet reference audit

Reference repository:

`androoAGI/starnet`

Useful implementation patterns adopted conceptually:

1. local/runtime state and UI projection must share one contract;
2. rooms represent capability-scoped teams;
3. workflow lines are executable routing structures, not decorative belts;
4. agents are distinct bounded workers with explicit capabilities;
5. work has durable queue/outbox state;
6. budgets belong to workflow/run contracts;
7. runtime events should expose starts, tool use, cost, wait/failure/completion, and policy denials;
8. supervisor state should distinguish waiting, blocked, failed, completed, and stale work;
9. the interface must never claim state the harness cannot prove.

StarNet is MIT-licensed code, but its name, logo, station artwork, sprites, and brand identity are explicitly outside that code license. Jhadina should reuse architectural ideas or separately reviewed MIT code where appropriate, not the StarNet brand or artwork.

## Canonical doctrine

Observe markets aggressively. Copy creative assets never.

The operating loop is:

market observation
-> paid-problem thesis
-> evidence cluster
-> MAKE IT MAKE SENSE
-> originality / IP gate
-> bounded experiment
-> outcome
-> reusable workflow
-> supervised automation
-> productization
-> scale / pause / kill
-> cross-venture learning

Marketplace competitors may be used as evidence of:

- buyer demand;
- pricing;
- review velocity;
- search language;
- personalization mechanics;
- fulfillment expectations;
- recurring customer pain;
- product/category gaps;
- distribution patterns.

They are not authorization to reproduce:

- artwork;
- protected characters;
- logos;
- trademarks;
- copied phrases;
- distinctive trade dress;
- deliberate style clones;
- another seller's files or product photography.

The desired transformation is:

`successful artifact -> underlying buyer mechanic -> unmet angle -> original offer`

not:

`successful artifact -> replica`.

## VENTURE-FACTORY.1 — Opportunity Schema

`VentureOpportunity` binds a venture to the canonical `Opportunity`.

It carries:

- canonical Side Hustle family/profile;
- lifecycle stage;
- paid-problem / buyer / job-to-be-done thesis;
- market signals;
- unit economics;
- Venture score;
- MAKE IT MAKE SENSE vote;
- originality decision;
- execution owners;
- monetization models;
- risk flags;
- evidence references.

All external-action flags are fixed false in this layer.

## VENTURE-FACTORY.2 — Market Scouts

A market scout produces `VentureMarketSignal` records.

Supported signal classes include:

- sales;
- reviews;
- search;
- social;
- pricing;
- competition;
- buyer pain;
- repeat purchase;
- platform velocity.

Each signal has source provenance, observation time, confidence, and an explanatory note.

The future runtime can connect these records to marketplace/browser/search adapters without changing the domain contract.

## VENTURE-FACTORY.3 — Demand Intelligence

`VentureDemandThesis` separates observed supply from the reason customers buy.

Required concepts:

- buyer;
- job to be done;
- paid problem;
- market mechanic;
- unmet angles;
- disconfirming evidence;
- evidence references.

This prevents "it sells, therefore clone it" reasoning.

## VENTURE-FACTORY.4 — Originality / IP Gate

`assessVentureOriginality` blocks:

- intentional style cloning;
- unresolved protected terms;
- protected characters;
- copied phrases;
- competitor-artifact references that have not been abstracted into market mechanics.

A passing result still explicitly records:

- `directReplicationAuthorized=false`;
- `competitorAssetReuseAuthorized=false`.

## VENTURE-FACTORY.5 — Product Lab

The Product Lab consumes a passing demand thesis and originality gate.

It should create original offers/products using the execution owner appropriate to the family.

Examples:

- PupsonStuff / generalized POD -> original art + product mockups;
- Director -> thumbnail / visual / media concepts;
- Builder -> software prototype;
- Music -> music/licensing product;
- Growth -> content/affiliate/owned-media concept.

Generation is downstream of market evidence, not a substitute for it.

## VENTURE-FACTORY.6 — Experiment Engine

`createVentureExperimentProposal` creates bounded experiment proposals only.

It requires:

- passing originality;
- sufficient coherence;
- hypothesis;
- buyer;
- offer;
- channel;
- explicit spend cap;
- hour cap;
- duration cap;
- minimum observations;
- success metrics;
- kill metrics;
- evidence.

Every proposal has:

`requiresApproval=true`

and:

`authorizationEffect=NONE`.

The existing Side Hustle experiment runtime remains the canonical experiment execution/evaluation path.

## VENTURE-FACTORY.7 — Commerce / Execution Adapters

Venture Factory identifies `executionOwners` from the canonical Side Hustle profile.

It does not duplicate commerce or fulfillment engines.

Examples:

- `pod_personalized_commerce` -> PupsonStuff / Commerce;
- `software_apps` -> Builder / Commerce;
- `owned_media` -> Media / Growth;
- `procurement_subcontracting` -> Opportunity / SAM.

## VENTURE-FACTORY.8 — Growth Router

Validated ventures may hand original offers to the existing Growth / Director / Social / AEO machinery.

Promotion must preserve:

- venture ID;
- experiment/outcome evidence;
- creative originality receipt;
- source attribution;
- spend/publish authority from the actual execution owner.

## VENTURE-FACTORY.9 — Venture Ledger

The domain includes explicit `VentureWorkItem` spend and output references for agent-work observability.

The HQ projection computes only observed:

- running work;
- blocked work;
- completed work;
- failed work;
- agent spend.

Revenue truth should continue to come from realized Outcome / Money / commerce receipts, not from the visual layer.

## VENTURE-FACTORY.10 — Supervisor

`superviseVentureWork` detects:

- stale work;
- queue pressure;
- repeated failures;
- weak margin;
- refund spikes.

Supervisor recommendations include:

- observe;
- repair;
- pause;
- kill;
- escalate.

Every issue fixes:

`automaticExternalActionAuthorized=false`.

The supervisor may diagnose and route repair work, but does not gain hidden authority by being "the boss agent."

## VENTURE-FACTORY.11 — Cross-Venture Memory

`VentureMemoryRecord` supports venture-, family-, and portfolio-scoped lessons with evidence and confidence.

Examples:

- personalization beats generic designs for a specific buyer;
- a certain channel produces cheap validation but weak realized conversion;
- a product family has high refund complexity;
- a workflow consistently requires human repair;
- a seasonal signal does not persist.

Memory is evidence-backed learning, not a permanent claim that a past winner will always remain a winner.

## VENTURE-FACTORY.12 — Capital / Resource Allocator

`allocateVenturePortfolio` creates resource-priority recommendations and evidence-weighted shares.

It can mark ventures:

- high;
- medium;
- low;
- blocked.

It cannot move money.

Every allocation carries:

`moneyMovementAuthorized=false`.

Coffer / the governed finance authority remains responsible for actual capital movement.

## VENTURE-FACTORY.13 — Autonomous Venture Lifecycle

Active stages are forward-only and one-at-a-time:

`discovered -> researched -> validated -> prototyped -> shadow -> launched -> optimizing -> scaling`

Terminal/control states:

- paused;
- killed;
- archived.

Originality must pass before active progression.

MAKE IT MAKE SENSE must pass before `validated` or later.

Automation maturity remains a separate canonical concept in Side Hustle maturity:

`unvalidated -> human_delivered -> ai_assisted -> workflow_automated -> exception_managed -> autonomous_cell`

Lifecycle and automation maturity must not be conflated.

## VENTURE-FACTORY.14 — Spatial HQ

The HQ domain consists of:

- rooms;
- agents;
- work items;
- workflows;
- an observed ledger.

Rooms are capability-scoped team views.

Agents have:

- class;
- capability set;
- execution owners;
- concurrency limit;
- active state.

Workflow graphs have bounded:

- hop count;
- spend per work item;
- optional daily spend.

Unbounded cycles are rejected.

The visual HQ should eventually render real rooms such as:

- Research Lab;
- Product Lab;
- POD Factory;
- Director Studio;
- Music Studio;
- Opportunity / Procurement War Room;
- Growth / Distribution;
- Supervisor / Command Center;
- Treasury view.

Treasury is a view into finance authority, not finance authority itself.

## VENTURE-FACTORY.FINAL

`certifyVentureFactoryFinal` separates software completion from live evidence.

Software requires:

- opportunity schema binding;
- market signal binding;
- originality gate;
- MAKE IT MAKE SENSE;
- experiment bridge;
- lifecycle;
- supervisor;
- memory;
- portfolio allocator;
- spatial projection;
- action governance;
- external Money authority;
- zero duplicate authority paths.

Live pass requires at minimum:

- 3 discovered market signals;
- 1 bounded experiment;
- 1 realized commercial outcome;
- 1 supervisor repair receipt;
- 1 spatial-runtime receipt;
- zero unauthorized external actions;
- zero copied creative assets.

The higher-level `OpportunityFactoryFinal` now requires a passing Venture Factory certification for its own live pass.

## Current certification rule

A software-green build is not allowed to pretend it has completed the live business loop.

Until a real bounded experiment produces a realized commercial outcome plus runtime/supervisor receipts, the correct final state is:

`softwareStatus=pass`

`liveStatus=blocked`

`status=blocked`

That is an evidence gap, not a software-completeness failure.

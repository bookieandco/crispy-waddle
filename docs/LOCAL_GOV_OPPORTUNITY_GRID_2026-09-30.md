# LOCAL-GOV Opportunity Grid — 2026-09-30

## Goal

Extend the existing SAM / Opportunity Factory / Provider Graph into an always-on U.S. public-procurement grid.

The operating target is:

`federal + state + county + city + school + special district + authority + public works + early capital signals + awarded primes -> Opportunity Factory -> PRIME / SUB / TEAM / CAPTURE / MONITOR / PASS -> Provider Graph -> Contract Precheck -> governed human approval`

Jhadina should discover and prepare opportunities automatically. Discovery is authorized; external contact, provider engagement, bid submission, contract execution, and payment remain governed actions.

## Reference implementation

California / Los Angeles is the first concrete source family:

- California Cal eProcure — statewide solicitation/vendor source seed.
- California DIR Public Works — public-works project/contractor source seed.
- Los Angeles County Doing Business — open solicitations, awarded contracts, vendor source seed.
- Los Angeles County Board agendas — early-capital / board / budget signal seed.
- City of Los Angeles RAMP — city solicitation/vendor/prime-sub source seed.

The domain manifest contains all 50 states plus DC as source-discovery targets and all 58 California counties as the first complete county catalog. Other states intentionally remain source-discovery work, not fabricated URLs or unsupported adapters.

## Implemented domain contracts

### `public-opportunity-grid.ts`

- national state/DC coverage manifest;
- California county reference catalog;
- official-source registry shape;
- adapter status and refresh policy;
- missing-source discovery planning;
- always-on discovery schedule planning;
- normalization into canonical `Opportunity`;
- public lifecycle stages:
  - early need
  - capital authorized
  - scoping
  - open solicitation
  - amendment
  - award
  - execution
  - closeout
- automatic route classification:
  - PRIME
  - SUB
  - TEAM
  - CAPTURE
  - MONITOR
  - PASS.

The router explicitly allows automatic discovery while keeping external contact, provider outreach, bid submission, contract execution, and payment unauthorized.

### `public-procurement-path.ts`

Models open bids, cooperative contracts, JOC, master agreements, small purchases, emergency and sole-source/other paths without assuming any vehicle guarantees a direct award.

Includes a specification-integrity gate. Evidence-backed diagnostics, lead-time, constructibility, lifecycle and interoperability input can be treated as technical input. Brand/proprietary steering is blocked without an independent procurement justification and preservation of lawful competition.

Procurement-path economics are learned from realized observations rather than source-video margin claims.

### `contract-precheck.ts`

Adds contract-to-cash and termination exposure analysis:

- retainage percentage and release conditions;
- controlled vs partial vs external payment dependencies;
- cash release control score;
- referenced-document gaps;
- termination-for-convenience trigger;
- recovery categories/exclusions;
- upstream recovery caps;
- settlement deadline risk;
- counsel-review flag.

The module describes the clause and modeled commercial exposure only. It does not make enforceability/legal conclusions.

### `provider-network-governance.ts`

Adds evidence-earned human provider authority:

- probationary / A / B / suspended provider grades;
- authority levels 0–4;
- technical quality, timeliness, communication, closeout, rework and complaint metrics;
- trade/geography capacity redundancy;
- single-provider risk;
- fulfillment incident root-cause/repair/regression capture.

Provider authority never becomes automatic contract authority or ungoverned customer communication.

## Existing systems reused

This build intentionally extends, rather than replaces:

- `sam-operating-system.ts`;
- `sam-operating-context.ts`;
- canonical `Opportunity`;
- requirement decomposition;
- provider evidence graph;
- provider matching;
- fulfillment plans;
- construction BOQ / tender model;
- provider quote evidence;
- SAM pricing/funding/proposal readiness;
- Prime Account / teaming relationship context;
- Opportunity Factory final authority boundary.

## Next implementation slices

1. **LOCAL-GOV.2 — live adapter runtime**
   - implement California/LA source fetchers behind the new adapter contract;
   - capture provenance and raw-source digest;
   - fail closed when portal parsing changes.

2. **LOCAL-GOV.3 — national jurisdiction catalog**
   - import an authoritative county/county-equivalent catalog;
   - recursively discover city, school, district, authority and procurement portals;
   - store adapter status per source.

3. **LOCAL-GOV.4 — persistence + scheduler**
   - durable source registry;
   - source health;
   - cursor/checkpoint state;
   - amendment/award dedupe;
   - nightly early-capital scans and frequent solicitation scans.

4. **LOCAL-GOV.5 — scope/package compiler**
   - turn local public-work scopes into subcontract work packages;
   - bind packages to Provider Graph, redundancy, quote lock and compliance evidence.

5. **LOCAL-GOV.6 — state-specific compliance packs**
   - California first: contractor/DIR/license/public-works requirements as evidence gates;
   - then state-specific packs without pretending one state's rules generalize nationally.

6. **LOCAL-GOV.7 — awarded-prime miner**
   - awarded contract -> prime account -> likely subcontract packages -> provider/relationship fit;
   - prepare outreach but preserve Action/CRM governance.

7. **LOCAL-GOV.FINAL — production certification**
   - live source evidence;
   - adapter health/coverage metrics;
   - end-to-end PRIME and SUB cases;
   - zero unauthorized external actions.

## Safety / authority invariant

The system can automatically search, normalize, score, classify, decompose, match, forecast, and prepare.

It cannot automatically contact a public buyer or provider, submit a bid, sign a contract, move money, or represent unsupported capability.

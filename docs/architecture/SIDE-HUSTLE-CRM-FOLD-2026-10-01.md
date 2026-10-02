# SIDE-HUSTLE CRM FOLD — 2026-10-01

## Goal

Make every Side Hustle easy to understand and operate without creating duplicate people, companies, CRM authorities or outreach executors.

Canonical ownership remains:

`Opportunity Core -> Side Hustle Business Factory -> Relationship Core lens -> Policy / Action Core for consequential execution`.

## Separation model

The canonical Side Hustle registry contains 26 families. Each family now has an explicit relationship scope made of named lanes such as:

- Prospects
- Customers
- Partners
- Vendors
- Suppliers
- Affiliates
- Creators
- Sponsors
- Buyers
- Primes
- Subcontractors
- Data Providers

Each lane maps to one or more shared CRM pipelines. The family-specific view is a projection over Relationship Core, not a new CRM.

A company that is both a supplier for one hustle and a prospect for another stays one canonical organization with separate side-hustle pipeline records.

## Procurement / Subcontracting

`procurement_subcontracting` has four explicit lanes:

1. Public Buyers -> `public_buyer`
2. Primes -> `sam_teaming`
3. Subcontractors -> `subcontractor_acquisition`
4. Teaming Partners -> shared prime/subcontractor relationship context

Existing live SWLC records were scoped without changing canonical entities:

- 1 buyer -> Buyers
- 26 SAM provider organizations -> Subcontractors
- 0 verified public-prime profiles -> Primes remains honestly empty

## Prime ↔ subcontractor matching

Opportunity Core now provides an evidence-backed prime/subcontractor matcher.

The matching unit is:

`awarded prime + opportunity + subcontract work package + subcontractor candidate`

Signals include:

- work-package/provider capability fit;
- NAICS / provider classification intelligence;
- service geography;
- provider capacity;
- evidence freshness;
- award/source evidence.

Outputs are:

- `matched_candidate`
- `review_required`
- `blocked`

Every match retains evidence references and explicitly sets:

- `externalContactAuthorized=false`
- `automaticProviderOutreachAuthorized=false`
- `bidSubmissionAuthorized=false`

The matcher does not turn a ranking into permission to contact, quote, bid, sign or pay.

## Automatic reconciliation

The existing hourly Relationship worker now also reconciles prime/subcontractor matches.

When public award mining produces all three required inputs:

1. a verified prime profile;
2. an evidence-backed work package;
3. provider candidates for that package;

the worker:

- computes the match matrix;
- resolves prime and subcontractor to canonical Relationship Core entities;
- persists a prime -> subcontractor edge;
- records an analysis-only relationship activity;
- updates hustle-scoped prime/subcontractor pipeline records.

At the time of this fold, the live public-prime/work-package/provider-candidate tables were empty, so no fake pairing was inserted. Matching will begin automatically when real evidence arrives.

## Access

The web app now exposes:

- Worlds -> Side Hustles
- Opportunities -> Side Hustle Business Factory
- `/opportunity/side-hustles`
- `/opportunity/side-hustles/[family]`

Each family page shows only its own lanes and stages. Clicking a relationship opens the shared canonical CRM entity.

Procurement additionally shows persisted Prime ↔ Subcontractor matches.

## Authority boundary

Side Hustle views organize context only.

- Relationship Core owns canonical people/organizations and relationship history.
- Opportunity Core owns opportunity/work-package/match intelligence.
- Side Hustle pipeline state does not authorize execution.
- Action Core / Safeguard remains the gate for outreach, bidding, spending, signing, publishing and other consequential actions.

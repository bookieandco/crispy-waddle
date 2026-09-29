# CRM-SPINE.FINAL — Shared Relationship / CRM Spine

Date: 2026-09-29

## Result

Jhadina now has one shared Relationship Core rather than a second CRM authority.

The design uses lessons from Comp AI CRM, Twenty, and Macro without vendoring their implementations. Comp is MIT; Twenty and Macro contain AGPLv3 code, so this implementation stays native to Jhadina.

## CRM-SPINE.1 — Canonical identities

Person and Organization are canonical entities. Provider, prime, customer, creator, affiliate, contractor, supplier and prospect are roles/projections.

Identity keys such as email, domain, UEI and CAGE are collision protected.

## CRM-SPINE.2 — Evidence and facts

The EvidenceLedger separates observations from canonical facts.

Strong or authoritative direct evidence can admit a fact. Two independent supporting sources can admit a fact. Weak evidence becomes a reviewable suggestion. Conflicting strong evidence becomes a conflict. Model self-confidence fields cannot create truth.

## CRM-SPINE.3 — Activity and context graph

One entity can link to opportunities, email, messages, tasks, documents, files, contracts, orders, social interactions and work sessions.

Domain systems keep authority over their source records.

## CRM-SPINE.4 — Durable due-work queue

The queue supports dueAt, priority, leases, lease expiry and reclaim, attempt count, correlation IDs, evidence references and budgets.

Production claims use FOR UPDATE SKIP LOCKED.

Every work item has executionAuthorized=false. CRM work may research, recheck, prepare or surface work; it cannot authorize outreach or other consequential action.

## CRM-SPINE.5 — Configurable objects and pipelines

The metadata registry supports reusable field definitions and pipeline stages without hardcoding every business domain into the relationship spine.

## CRM-SPINE.6 — Record / Agent workspace

The record workspace exposes Overview, People, Opportunities, Interactions, Files, Tasks, Evidence, Agent and Timeline.

The Agent surface shows queued and active work plus review state.

## CRM-SPINE.7 — SAM projection bridge

Existing Opportunity Core ProviderRelationshipEvent semantics remain authoritative. Relationship Core consumes their structural shape and projects provider events into shared roles, activity and context links.

## CRM-SPINE.8 — Cross-domain projections

SAM, Opportunity, Growth, Commerce, affiliate, PupsonStuff, Overage, Social and other domains can attach roles and activity to the same canonical entity.

## CRM-SPINE.9 — Durable persistence and governance

Migration 20260929153000_crm_spine_relationship_core.sql persists entities, identities, roles, evidence, facts, suggestions, activity, context links, configurable metadata, pipeline records and leased work.

Authenticated users can read only their own records. Writes and work-claim RPCs are service-role governed.

## CRM-SPINE.FINAL — Integrated certification

certifyCrmSpine exercises one organization end to end:

1. canonical organization identity;
2. evidence-backed fact admission;
3. SAM provider projection;
4. commerce customer projection onto the same entity;
5. leased due research work;
6. metadata-defined pipeline movement;
7. record workspace aggregation;
8. one entity and one history.

The package test suite requires all ten gates to pass.

## Authority boundary

The CRM spine cannot send email, submit bids, spend money, publish, sign agreements, mutate domain-source truth, or grant Action Core authority.

The runtime remains:

relationship intelligence -> domain intelligence -> policy / Safeguard -> Action Executor -> connector -> receipt -> activity/evidence

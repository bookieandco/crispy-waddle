# CRM-PROD.FINAL — Production Relationship Runtime

Date: 2026-10-01  
Target runtime: Jhadina / SWLC  
Source PR: #949

## Verdict

CRM-PROD.1 through CRM-PROD.FINAL are implemented in source and the production database admission/canary has been executed against SWLC.

The Relationship Core remains an intelligence/context system. It does not grant authority to send outreach, spend money, bid, sign, publish, or perform any other consequential external action.

## CRM-PROD.1 — Production Database Admission

The repository had substantial pre-existing Supabase migration-history drift. The CRM admission therefore did **not** use a blind database push and did not rewrite historical migration records.

Reconciliation established that the CRM schema and queue RPCs were genuinely absent in SWLC. The checked-in CRM DDL was applied surgically and then hardened.

Live admission evidence:

- 14 relationship tables are present, including durable relationship edges and analysis-only intelligence;
- row-level security is enabled;
- owner-select policies are installed;
- `anon` has no CRM table privileges;
- `authenticated` has SELECT only, still constrained by RLS;
- `service_role` owns server-side mutation privileges;
- queue claim and completion RPCs cannot be executed by `anon` or `authenticated`;
- queue RPC execution is limited to `service_role`;
- a rollback-safe service-role lease/complete probe passed and left zero probe rows.

The source migration was also repaired to revoke **all** inherited `anon`/`authenticated` table privileges before granting owner-readable SELECT.

## CRM-PROD.2 — Live Repository + API

Jhadina Web now depends on `@jhadina/relationship-core`.

`ProductionRelationshipRepository` is owner-bound. Every privileged query is filtered by the authenticated owner ID and the browser never receives a service-role client or credential.

Authenticated API surfaces:

- `GET /api/relationships`;
- `GET /api/relationships/[entityId]`;
- `GET /api/relationships/[entityId]/timeline`;
- `GET /api/relationships/[entityId]/evidence`;
- `GET /api/relationships/[entityId]/pipeline`;
- `GET /api/relationships/[entityId]/agent`;
- `POST /api/relationships/backfill`.

Internal scheduler-only context and worker endpoints use the existing GitHub-OIDC scheduler identity.

## CRM-PROD.3 — Opportunity / SAM Event Bridge

Real `ProviderRelationshipEvent` and `PrimeRelationshipEvent` shapes project into shared relationship state without replacing Opportunity Core authority.

The bridge:

- resolves durable identities first;
- upserts the canonical organization;
- records provider/prime roles;
- links the Opportunity context;
- records relationship activity;
- updates the appropriate pipeline;
- schedules read/research continuity work;
- records strong durable SAM identifiers through observation -> verified-fact lineage;
- fuses future contract/subcontract events into contract context.

No event bridge grants external execution authority.

## CRM-PROD.4 — Existing Data Backfill

Backfill is evidence/identity-first and never merges organizations by name alone.

Live source inventory during admission:

- 40 SAM provider candidate observations;
- those reconcile to 26 canonical provider organizations;
- 14 duplicate observations collapse onto existing durable identities;
- 13 active public-opportunity observations;
- those reconcile to one canonical public buyer with 13 opportunity contexts;
- prospect, Growth customer, Social contact, public-prime and public-package-provider sources were empty at admission time and were not fabricated.

After live backfill:

- 27 canonical organizations;
- 52 identity records;
- 53 role/context observations before document fusion;
- 27 pipeline records;
- 27 fail-closed due-work records.

## CRM-PROD.5 — Actual CRM Workspace

Jhadina Web now exposes a real `/relationships` workspace and entity record view.

The record surface implements:

- Overview
- People
- Opportunities
- Interactions
- Files
- Tasks
- Evidence
- Agent
- Timeline

Relationships are also discoverable from Jhadina's Worlds navigation.

The Agent tab explicitly states that CRM work cannot authorize consequential external actions.

## CRM-PROD.6 — Autonomous Relationship Worker

The relationship worker is registered on the canonical `Jhadina Production Scheduler`.

Cadence:

`50 * * * *`

The scheduler uses the existing GitHub OIDC path; no duplicate cron authority or copied production secret was introduced.

Admitted worker capabilities are read/research-only:

- `relationship.research`;
- `relationship.refresh_provider`;
- `relationship.refresh_prime`;
- `relationship.quote_continuity`.

Failures intentionally leave the lease in place so expiry/reclaim provides crash-safe at-least-once behavior.

## CRM-PROD.7 — Communication + Context Fusion

Context fusion supports:

- email;
- messages;
- tasks;
- files;
- documents;
- contracts;
- orders;
- social/work-session/other context through the generic evidence-backed contract.

The hourly relationship cycle reconciles the sources currently available in SWLC:

- SAM documents;
- approved Social message outbox;
- Growth customer events/orders;
- explicitly relationship-tagged WorkSession tasks;
- explicitly relationship-tagged artifacts.

At admission time, Social outbox, Growth events, WorkSession tasks and artifacts contained zero records. They were not simulated.

SAM documents did contain real data. Live reconciliation produced:

- 40 document-context links;
- document context across all 26 provider organizations represented by the matching SAM opportunities.

Email has no native SWLC message store in the audited schema; the governed internal context endpoint is the ingestion seam for an authorized email connector/runtime.

## CRM-PROD.8 — Pipeline Automation

Six metadata-driven pipelines are active in SWLC:

1. SAM Teaming;
2. Public Buyer Relationship;
3. Subcontractor Acquisition;
4. Commercial Prospecting;
5. Affiliate / Vendor Management;
6. Customer Lifecycle.

Prepared outreach maps only to draft/approval-required stages. Action Core remains the authority gate for actual outreach.

## CRM-PROD.9 — Relationship Intelligence

Derived signals are persisted separately from facts with:

`authority = ANALYSIS_ONLY`

Implemented signals:

- relationship freshness;
- last interaction;
- unanswered thread;
- quote aging;
- provider/prime continuity;
- known decision-maker count;
- opportunity overlap;
- evidence conflict count;
- recommended next research step.

Durable SAM identifiers were also reconciled into the evidence ledger:

- 26 strong identity observations;
- 26 verified facts;
- 26/26 verified facts resolve to their observation evidence.

Analysis signals are never promoted into facts automatically.

## CRM-PROD.FINAL — Real Entity Canary

The final canary used a real SAM provider already discovered from public federal-spending evidence. It did not create a fictional company.

Preconditions found on the chosen entity:

- canonical organization;
- durable identity;
- evidence-backed observation;
- verified fact;
- provider roles;
- linked opportunities;
- pipeline state.

Canary sequence:

1. insert a due read-only `relationship.research` work item;
2. worker A claims the item;
3. worker A is deliberately treated as crashed — no completion or release occurs;
4. time advances beyond the lease;
5. worker B reclaims the same work item;
6. attempt count becomes 2;
7. a read-only completion activity is persisted;
8. analysis-only intelligence is persisted;
9. worker B completes the item;
10. an independent post-commit read reloads the persisted state.

Reload evidence:

- canary status: `completed`;
- attempts: `2`;
- `execution_authorized = false`;
- completion receipt: `externalMutationPerformed = false`;
- verified-fact lineage remains present;
- analysis signals remain `ANALYSIS_ONLY`.

## Runtime authority boundary

The production path is:

`relationship evidence/context -> domain intelligence -> Safeguard / policy -> Action Executor -> connector -> receipt -> relationship timeline`

Relationship Core may decide that research or follow-up planning is due. It cannot make the consequential external action authorized merely because a CRM stage or recommendation says it should happen.

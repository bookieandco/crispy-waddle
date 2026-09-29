# TRANSCRIPT-FOLD.RUNTIME.1 — Durable Runtime Wiring

Date: 2026-09-28  
Repository: `bookieandco/crispy-waddle`  
Supabase project: SWLC / `kqbkaozfjubkjevdfvic`

## Objective

Promote the transcript-derived commercial/creator contracts from in-memory planning types into authenticated durable runtime state without widening any execution authority.

## Durable records

### Opportunity / commercial learning

`public.jhadina_commercial_learning_records`

Kinds:

- `offer_canvas`
- `validation_test`
- `market_learning`
- `proof_sprint`
- `recurring_offer_assessment`

Every row is user-owned, bound to a canonical Opportunity, RLS-protected, directly readable by the owner, and mutable only through the authenticated `jhadina_commercial_learning_upsert` RPC.

### Prospect intelligence

`public.jhadina_prospect_icps`  
`public.jhadina_prospects`

The prospect write RPC enforces:

- canonical contact-quality states;
- canonical suppression states;
- `authority = RESEARCH_ONLY`;
- `outreachAuthorized = false`;
- nonempty evidence;
- an existing user-owned ICP.

These records can inform later governed outreach drafting. They cannot send outreach.

### Social publish canary

`public.jhadina_social_publish_canaries`  
`public.jhadina_social_platform_receipts`

A canary plan remains `PLANNING_ONLY`.

Receipts are not caller-asserted publication claims. The capture RPC reads the existing user-owned `jhadina_social_outbox` row and derives:

- platform;
- provider;
- account;
- provider post ID;
- delivered/failed/ambiguous state;
- evidence reference to the durable outbox row.

A canary receipt therefore layers verification on the canonical Social publisher instead of becoming a second publication system.

## Application wiring

`createSupabaseOpportunityRepository()` now supports:

- list/upsert commercial learning;
- list/upsert prospect ICPs;
- list/upsert prospect records.

`createSocialRepository()` now supports:

- create/get publish-canary plan;
- list canary receipts;
- capture a receipt from a canonical Social outbox row.

Authenticated API surfaces:

- `GET/POST /api/opportunities/[id]/commercial`
- `GET/POST /api/opportunities/prospects`
- `GET/POST /api/social/canaries`
- `POST /api/social/canaries/[id]/receipt`

## Security / authority invariants

- `anon` has no SELECT or mutation privilege on the new tables.
- `authenticated` has SELECT only on the tables.
- writes flow through authenticated security-definer RPCs with explicit `auth.uid()` ownership checks.
- RPC EXECUTE is revoked from `PUBLIC` and `anon`.
- Social canary capture cannot publish; it can only observe an already-existing outbox job.
- Prospect persistence cannot authorize contact.
- Commercial-learning persistence cannot authorize spending, offers, bids, outreach, publishing, or any Action Core execution.

## Live verification

Applied to SWLC with migrations:

- `transcript_fold_runtime_1`
- `transcript_fold_runtime_1_indexes`

Verified live:

- RLS enabled on all five new tables.
- `anon SELECT = false`.
- `authenticated SELECT = true`.
- `authenticated INSERT = false`.
- all five new RPCs have EXECUTE for `authenticated` and `service_role`, not `anon`.
- transactional smoke test created:
  - one commercial-learning record;
  - one ICP;
  - one prospect;
  - one publish-canary plan;
  - one outbox-backed published receipt.
- the smoke transaction rolled back and left zero test rows.

## Next boundary

`TRANSCRIPT-FOLD.EVENTS.2` should emit/consume durable events around these records so real work can flow:

`WORK_EVENT / OPPORTUNITY_SIGNAL -> COMMERCIAL_RECORD -> MARKET_LEARNING -> CONTENT_CANDIDATE -> DIRECTOR -> SOCIAL_CANARY -> PLATFORM_RECEIPT -> OUTCOME -> FOCUS_REASSESSMENT`.

Runtime persistence itself grants no new external-action authority.

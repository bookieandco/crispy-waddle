# JhadinaOS Governance + Architecture Audit — 2026-09-09

## Scope

This audit reconciles the newly supplied architecture/database artifacts and security findings with the current `bookieandco/crispy-waddle` `main` branch. The supplied artifacts are treated as evidence, not as a substitute for the live repository.

Reviewed first-pass areas:
- identity/session boundary
- Commerce proposal/approval/execution lifecycle
- `verifiedUserId` propagation
- request identity headers
- durable proposal/approval/audit composition
- repository-wide CI gate
- database design claims versus implementation expectations
- work-queue governance

## Confirmed architecture strengths

1. Commerce already has a three-stage durable lifecycle: propose -> explicit approval -> execute.
2. Proposal fingerprints are recomputed from stored proposal data rather than accepted from an execution caller.
3. Approval receipts are single-use and checked before provider execution.
4. Commerce uses the shared `SecurityCoreActionPolicy`, approval receipt store, audit ledger, and governed payment provider rather than introducing a parallel payment authorization stack.
5. Request identity is backed by Supabase SSR `auth.getClaims()` and requires both `sub` and `session_id`.
6. The repository has a repository-wide launch gate covering install, type-check, lint, test, and production build.

## P0/P1 findings

### P0 — identity should never depend on a client assertion

Several API routes still read `x-jhadina-user-id` and historically defaulted it to `default-user`. This is the wrong control-plane shape: the server session is authoritative and client headers must not become the source of identity.

The live Commerce lifecycle itself was already safer than the route surface: `SupabaseActionIdentityVerifier` checked the supplied value against the verified Supabase subject. The defect was architectural coupling and the `default-user` fallback, not evidence that a mismatched header could directly override the verified subject.

**Repaired in this pass:**
- `SupabaseActionIdentityVerifier` now derives identity from verified claims and treats an optional caller user id only as a consistency assertion.
- Commerce proposal, approval, and execution routes no longer read `x-jhadina-user-id` or fall back to `default-user`.
- Added regression tests for server-derived identity, optional consistency assertion, and fail-closed session validation.

### P1 — the same identity cleanup must reach every governed vertical

Repository search still finds `x-jhadina-user-id` in Growth and Opportunity routes, plus other request adapters. Those are next in line. The correct pattern is:

`request -> server Supabase session -> verified AuthenticatedSession/identity -> capability/policy -> action -> provider -> audit`

not:

`request -> client user-id header -> domain service`.

No route should use `default-user` as an authorization fallback.

### P1 — `verifiedUserId` is output metadata, not authorization input

Many runtimes return `verifiedUserId`. That is acceptable as response/audit attribution only when it is populated from the server-verified identity. It must never be accepted from request JSON, a proposal payload, an approval payload, or a client header and then treated as verified.

Commerce now follows this rule at its HTTP boundary.

### P1 — live verification harnesses need an explicit test-only identity boundary

The repository contains live Stripe/Plaid verification files with static test actor identity implementations. These must remain isolated from production composition roots and must never be usable by an HTTP route or production executor. The next audit pass should prove this through import/reachability checks and tests.

### P1 — database design versus implementation needs reconciliation

The supplied database design says it is still in design phase while the wider repository already contains durable repositories, migrations, audit ledgers, approval stores, and Commerce proposal persistence. The canonical source of truth must become the actual migration/repository/runtime graph, with the design document updated to describe what is really implemented.

Required checks:
- user-scoped tables have `user_id`
- user-scoped reads/writes enforce ownership
- RLS/constraints/indexes/FKs match repository assumptions
- ReasoningEvents and TimelineEvents remain immutable
- approval and action audit records are durable and append-oriented
- no service silently falls back from Postgres/Supabase to an in-memory store in production

### P1 — work queue is the execution contract

`docs/JHADINA_WORK_QUEUE.md` explicitly requires real verification and status updates for `Next`, and distinguishes Audit from implementation. This audit is now recorded separately so future agents can consume the findings without treating an old artifact as live truth.

## CI status

`launch-gate.yml` is configured for pull requests and pushes to `main` and runs install/type-check/lint/test/build. The latest identity-repair commits are on `main`, but the GitHub Actions connector returned no workflow run associated with the latest push. Therefore CI is **not claimed green** for this repair set.

This is a verification gap, not a reason to bypass the gate.

## Repair order

1. Finish repository-wide request identity cleanup (`x-jhadina-user-id`, `default-user`).
2. Audit every `verifiedUserId` producer/consumer and remove any client-controlled path into authorization.
3. Reconcile database design docs with migrations, repositories, RLS and service composition.
4. Audit the canonical action path for every consequential vertical: Identity -> Capability -> Policy -> Approval (when required) -> Executor -> Connector -> External System -> Audit.
5. Prove test-only/live verification adapters cannot enter production composition.
6. Re-run repository type-check/lint/test/build and real CI; do not mark repaired tasks DONE without those results.
7. Produce the required structured interim Copilot handoff before context/execution exhaustion.

## Current repair commits

- `b390b34ad3b65535c63ba9feb327d57a998920cc` — identity verifier made server-authoritative.
- `4b45a6fd68e3ff8bf848d6e30e70cc3a6a285f22` — Commerce lifecycle uses optional client assertion only for consistency.
- `35e036cd11f578e017bbd4048af2aaa73ba55b18` — Commerce proposal route removes identity header/default fallback.
- `f59a936bce164a846f8a20b19cac195256c45734` — Commerce approval route removes identity header/default fallback.
- `76f182daceb0c09287eaee85ee8fe42e9c8d30e5` — Commerce execution route removes identity header/default fallback.
- `97a94febf0e913d1c62c9f29d69482d9e23d2067` — identity-boundary regression tests.

## Acceptance rule

A subsystem is not considered repaired merely because its source code looks governed. It must have:
- one canonical identity source;
- one canonical policy boundary;
- no client-controlled authorization identity;
- no consequential executor reachable without policy/approval requirements;
- durable audit attribution;
- tests for spoofing, replay, cross-user access and stage skipping;
- successful type-check/lint/test/build and, where applicable, real CI.

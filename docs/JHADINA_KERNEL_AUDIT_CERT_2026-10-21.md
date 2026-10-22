# JHADINA-KERNEL-AUDIT / CERT — 2026-10-21

## Scope

Ordered reconciliation from `JHADINA-KERNEL-AUDIT.1 — Current-main inventory` through `JHADINA-KERNEL-CERT.FINAL — Live proof`.

Frozen kernel rule:

```text
JANET -> DELIA -> MARISA -> VerifiedActionExecutor
      -> Identity -> Policy -> Handler -> Durable Audit Ledger
```

JANET, DELIA, and MARISA are roles in the canonical spine. They are not independent executors and do not receive separate approval, policy, or audit authority.

## AUDIT.1 — Current-main inventory

Evidence-backed inventory found:

- canonical request identity verification through Supabase server claims;
- shared Action Core with `VerifiedActionExecutor`, Security Core policy, approval receipts, and `SupabaseAuditLedger`;
- Ask Jhadina governed Intelligence path;
- durable Memory, Reasoning, Timeline, WorkSession, Growth, Commerce, Money, Social, Opportunity, Director, Spatial, and specialist runtimes;
- JANET as memory/context/orchestration code;
- DELIA as strategy/intelligence role;
- MARISA as operations/proposal/work-queue role without independent executor authority.

The legacy `createJhadinaApplication().execution = not_configured` field is not the live execution authority. Its application object is consumed by request identity wiring; no production route consumes its `execution` placeholder.

## AUDIT.2 — Execution-path reconciliation

Concrete bypasses found on current main:

1. `/api/message` created durable memory candidates through `JanetService.processMessage()` without Action Core.
2. Memory approve/reject/correct/forget handlers mutated canonical memory storage directly.
3. Intelligence and Growth production flows instantiated bare `ActionExecutor` after manual identity verification instead of using the frozen `VerifiedActionExecutor` boundary.

Repairs on PR #891:

- legacy message path is a compatibility adapter into the governed spine;
- memory approve/reject/correct/forget now cross verified identity, policy, approval when required, `VerifiedActionExecutor`, handler ownership checks, and durable audit;
- Intelligence memory proposal, Growth draft approval, and paid Growth execution use `VerifiedActionExecutor`;
- rejected/spoofed identity claims are not written into a user-scoped audit ledger under an unverified actor.

## AUDIT.3 — Live Supabase kernel boundary

Connected Jhadina project: `kqbkaozfjubkjevdfvic`.

Live inspection verified RLS enabled on:

- `jhadina_audit_ledger`
- `jhadina_audit_ledger_head`
- `jhadina_memories`
- `jhadina_memory_candidates`
- `jhadina_reasoning_events`
- `jhadina_timeline_events`

Policies verified:

- authenticated users may read only their own audit events;
- audit-chain head is service-role only;
- canonical memory/reasoning/timeline storage is service-role only.

The live database had drifted from the repository's older audit migration: production uses `jhadina_audit_ledger` / `jhadina_audit_ledger_head`, while application callers use the canonical RPC names `append_jhadina_audit_event` and `list_jhadina_audit_events`.

Applied live migration:

`jhadina_audit_authenticated_rpc_reconciliation`

The migration preserves the live tables and hash chain, adds actor-bound authenticated RPC access, rejects actor mismatch, and retains service-role access.

Before this repair the live audit head was `GENESIS` with event count `0`.

## AUDIT.4 — Policy / approval / adversarial boundary

Memory capability classifications now explicitly include:

- `memory.propose`
- `memory.commit`
- `memory.reject`
- `memory.correct`
- `memory.forget`

Destructive retirement/rejection operations require explicit approval. Correction is reversible and still crosses policy/executor/audit. Unknown capabilities remain fail-closed.

Adversarial tests cover:

- spoofed identity;
- policy denial;
- cross-user candidate ownership;
- destructive approval receipt requirement;
- handler failure;
- durable audit failure before mutation;
- legacy message compatibility without bypass.

## AUDIT.5 — Justice convergence

Justice references are provenance/reference-only, never execution or legal authority.

Existing registered references:

- `statedecoded`
- `citation-regexes`
- `statedb`

Added from the user-supplied Justice reference set:

- `awesome-legal`
- `Legal-Text-Analytics`
- `claude-legal-skill`
- `Tax-Calculator`
- `digitalgov-pra`
- `justia_scraper`

All remain non-authoritative. Registration does not authorize scraping, treat scraped text as verified law, or grant legal-advice/execution authority.

## CERT.1 — Source adversarial proof

Required:

- frozen install;
- repository type-check;
- focused kernel tests;
- full Jhadina Web tests;
- production build;
- Reference Provenance certification;
- exact-head CI.

Status: IN PROGRESS on PR #891. Do not upgrade to PASS until the latest exact head is green.

## CERT.2 — No parallel executor proof

Required:

- no production JANET/DELIA/MARISA-owned executor;
- no legacy memory write bypass;
- production mutation paths use canonical Action Core / VerifiedActionExecutor;
- specialist systems may prepare proposals/work but do not gain approval authority from context alone.

Status: source repair complete; exact-head CI pending.

## CERT.3 — Live deployment proof

Required sequence:

```text
build
-> deploy
-> health
-> authenticated request
-> governed action
-> durable audit event
-> Activity read-back
-> persistence read-back
```

A Vercel preview/build success alone is insufficient.

## JHADINA-KERNEL-CERT.FINAL — Live proof

NOT CERTIFIED until all of the following are captured against the same deployed commit:

1. exact commit SHA and successful CI;
2. READY deployment for that SHA;
3. authenticated owner/session request;
4. governed action accepted through VerifiedActionExecutor;
5. corresponding `jhadina_audit_ledger` event;
6. `/api/system/activity` read-back of that event for the same verified actor;
7. durable state read-back after a separate request/process boundary;
8. negative control showing an unauthenticated or identity-mismatched request fails closed without mutation.

No source-only claim may substitute for these live receipts.

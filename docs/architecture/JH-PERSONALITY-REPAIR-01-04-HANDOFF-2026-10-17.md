# JH-PERSONALITY-REPAIR.01–.04 — source repair and continuation handoff

**Date:** 2026-10-17  
**Base:** `main` at `dd2e773eb756c1bee65818704810267104856e15`  
**Branch:** `repair/jh-personality-01-04-20261017`  
**Upstream handoff:** `JHADINA-PERSONALITY-DEEP-AUDIT-HANDOFF-2026-10-17.md` (prior conversation/Library report)  
**Boundary:** source-only. No live commissioning, database changes, voice activation, provider calls, spending, or owner evidence read.

## .01 — reconciled, not rebuilt

- Preserved already merged PR #1151 and existing PersonalityState, RNC, Behavior/Expression Kernel, Quip Engine, banter, callbacks and Voice boundaries.
- Current `main` and identified paths agreed with the pinned audit.
- PR #1323 is still a separate draft stack on #1322; its SWLC/Supabase source/data-plane recovery is **AUDIT/REPAIR REQUIRED**, not silently merged or replaced. Do **not** use the PupsonStuff database.
- No applicable `AGENTS.md` was found at the inspected repo, apps/packages or changed component directories.
- This branch changes bounded existing files only; it does not copy diverged historical branches.

## .02 — multi-turn and shortcut parity

- `deriveBehaviorContextWithRecentTurns` scans at most eight previous turns, skips consecutive acknowledgement-only user turns and inherits serious/distress/high-stakes posture from the last substantive user turn. A substantive new topic stops the chain.
- English and several common Spanish short acknowledgements are supported. This is a small lexical guard, **not** comprehensive multilingual understanding.
- Deterministic command shortcuts pass the same bounded recent-turn context already parsed for general Ask into `realizeAskJhadinaExpression`.
- Read-only expression shortcut accepts bounded, validated recent-turn shape as contextual presentation only; client-supplied transcript is **not** an authenticated session receipt or approved memory.
- Shortcut expression uses the shared risk classification, suppresses quips/profanity under inherited serious/precision modes, passes recent turns to optional craft, and reports personality context limitations instead of silently implying durable continuity.
- Tests cover distress then multiple acknowledgements, Spanish continuation, topic reset and shortcut propagation. Server-owned session persistence, robust topic transition and multi-device lifecycle remain in LIVE.4–.5.

## .03 — conservative quip admission

- Parses optional candidates as **untrusted presentation text**, never as evidence/Memory/permission.
- Allows topical content words only from the semantic answer and a narrow, explicit non-factual rhetorical vocabulary; rejects novel lexical claims, invented history, unsupported numbers and unsafe/disallowed language. Empty/no-joke is valid.
- Scores are heuristic rankings, **not** semantic truth or human-naturalness measurements. This method is intentionally conservative; human acceptance must assess unnatural false negatives and subtler unsupported assertions.
- Separate provider requests require `JHADINA_LIVE_QUIPS_ENABLED=1` **and** `JHADINA_QUIP_PAID_CALLS_APPROVED=1` (or a scoped explicitly approved injected test/runtime option). Both remain disabled without opt-in. A generated adapter may issue at most one request.
- Tests add recall/invented-camping/fabricated-event rejection, cost opt-in, one-request budget, transport and serious-mode fallback.
- No provider invocation was performed while preparing this patch.

## .04 — certification integrity

- Pure `evaluatePersonalityLiveFinal` **cannot certify** unverified self-reported source or live receipts.
- `certifyPersonalityLiveFinal` is a separate async contract taking a server-controlled `PersonalityCertificationReceiptVerifier`; it only upgrades source/text evidence after structurally valid receipts are independently verified. **No production verifier is installed by this PR**.
- Structural gates require exactly six distinct exact-head CI receipts, valid trimmed IDs, finite safe integer counts, time observations not later than evaluation, reviewer ID uniqueness/nonblank, count consistency, and explicitly true evidence flags.
- The trusted verifier implementation must authenticate real GitHub job conclusions, served deployment SHA, distinct owner-scoped session and transcript case IDs, independent reviewers, revocation/forget results and artifact source identities. A unit-test fake is **never** certification evidence.
- Tests include invalid Infinity, fractional counts, future dates, whitespace/duplicate review IDs, mismatched SHA, duplicate checks and verifier denial.

## Focused validation to run at exact PR head

```bash
pnpm --filter @jhadina/core-spine type-check
pnpm --filter @jhadina/core-spine test -- src/personality-live-final.test.ts
pnpm --filter @jhadina/jhadina-web type-check
pnpm --filter @jhadina/jhadina-web test -- src/lib/context/context-builder.test.ts src/lib/intelligence/ask-expression.test.ts src/lib/personality/live-quip-provider.test.ts
```

Run the broader existing Personality, RNC, Ask/Web integration and CI exact-head suites before merge. Green workflow metadata is insufficient when jobs are skipped. This report does **not** assert those checks have passed unless exact-head results are separately attached to the PR.

## Scope, non-goals and next sequence

- No migration, RLS/probe/repair, production credential change, cross-user access test, deploy, live message, audio audition, paid inference, wallet action or external publication.
- Source completion does not prove lived continuity, rich independent taste/opinion, human naturalness or approved original voice.
- After exact-head checks and reviewed merge, continue existing **JHADINA-PERSONALITY.LIVE.4–.5** for durable owner-scoped ephemeral sessions, bit/callback lifecycle and bounded replay; then **LIVE.6–.9 → FINAL** with real human and device evidence.
- Independently close SWLC/Supabase recovery, authenticated identity/RLS, backup+restore and live persistence gates under the proper JH-CLOSE sequence; never mask a storage outage with an empty profile.

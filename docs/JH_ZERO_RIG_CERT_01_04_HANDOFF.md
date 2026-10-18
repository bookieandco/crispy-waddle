# JH-ZERO-RIG.CERT.01 → .04 — stack reconciliation and operational acceptance

## Scope and source
- Base PRs: #1375 (research), #1377 (sandbox and mobile), #1380 (owner-only read-only scout).
- Their branch heads were reconciled with the then-current main, in dependency order, using ancestry-preserving commits and selective file overlays, not destructive replacements.
- This PR adds a pure, offline **release-evidence contract**. It cannot perform live API calls, issue agent keys, attest real iPhone sessions, or authorize spending.

## CERT.01 — Reconciliation
Inspect GitHub PR state, exact-head checks, review approvals and merge conflict flags before any ordered merge. Do not conflate clean mergeability with live commissioning.

## CERT.02 — Owner-only read commissioning
A real operator must create and human-claim the single Superteam agent through the official service, then provision `ZERO_RIG_OWNER_USER_ID` and a server-only `ZERO_RIG_SUPERTEAM_API_KEY` in the existing protected runtime. The feature remains off unless owner separately enables `ZERO_RIG_SUPERTEAM_READS_ENABLED=true`. Never add secrets or claim codes to source, CI output, chat, or NEXT_PUBLIC variables. Before enabling across multiple instances, provision a cross-instance rate limiter and an emergency disable switch.

## CERT.03 — Real iPhone owner acceptance
For a real authenticated iPhone session, record the exact deployed Git head, app URL within private acceptance records, timestamp, successful owner read, unauthorized-user 401/403, accidental multiple-click behavior, mobile viewport usability, safe no-store responses, no token exposure, and no external actions. Confirm the same data cannot be accessed by other tenants; a green build alone is not mobile acceptance.

## CERT.04 — Real listing and financial evidence
With the approved agent API key, manually trigger an authenticated GET `/api/agents/listings/live?take=20`. Preserve **sanitized**, timestamped response-field/contract evidence. Verify 200, 401 and 429 behavior safely, actual agentAccess/expiry, listing details and eligibility questions, human payout terms, and source accuracy. Never infer an unobserved listing or guaranteed reward. For any future payout claim, Money Core needs separately reconciled real transaction receipts; points or modeled rewards are not evidence.

`zero-rig-live-certification.ts` refuses source/canary readiness when evidence is missing, stale, unreviewed or attached to a different head. `ready_for_separate_release_approval` means the provided evidence passed structural checks; it is NOT independent attestation, permission to poll, submit, claim, or spend.

## Source and policy gates
- `pnpm --filter @jhadina/opportunity-core type-check`
- `pnpm --filter @jhadina/opportunity-core test`
- `pnpm --filter @jhadina/jhadina-web type-check`
- `pnpm --filter @jhadina/jhadina-web test`
- `pnpm --filter @jhadina/jhadina-web build`
- Actual production commissioning remains blocked until independent operational evidence exists.

## Current scope
This is a source-only, reviewable certification change. No owner Superteam API key, production environment, live iPhone interaction or real payout was accessed by this PR.

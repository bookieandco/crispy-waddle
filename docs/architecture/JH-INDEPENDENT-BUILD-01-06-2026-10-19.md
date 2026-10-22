# JH-INDEPENDENT.BUILD.01–.06 — source-only closeout and iPhone lab

**Base commit:** `8dfd9a7964a771580f1c24e30bfd3f45f48da2b4` (`main` read at sequence start).
**Branch:** `feat/jh-independent-build-01-06-20261019`.
**Scope:** Independent, zero-network, ephemeral mobile interaction acceptance while canonical SWLC project `kqbkaozfjubkjevdfvic` is unavailable.

## Critical distinction

This sequence **does not** mark the existing JLLM, Music Stream, Facebook Memory, Home social feed, or Voice subsystem production-ready. It delivers an explicitly synthetic interaction laboratory and cross-branch release plan without copying old divergent files onto `main`. The existing feature branches remain separate pending exact-head reconciliation. No SWLC migration, secrets, API, original archive import, social connection, copyright media playback, financial action, billable provider, production rollout, or public site exposure occurred.

## .01 — Current-main and dependency reconciliation

Before touching shared production routes, inspect the canonical donor patches, their integration points and their states:

| Subsystem | Canonical donor | Overlap / safe integration condition |
| --- | --- | --- |
| Home multi-source and feed | PR #1404 followed by #1416 | Shared YouTube OAuth, saved social and Home; SQL proposal **UNAPPLIED**; actual authenticated SWLC RLS and provider consent are external gates |
| Facebook writing cues | PR #1418, supersedes older #1351 donor | Auth/password/middleware and ContextBuilder overlap with Music and login routes. Do not overwrite current Auth with old branch. Owner local ZIP review can occur without storing content |
| Typed JLLM visuals | PR #1414 and voice-compatible #1417 | Both touch `ask-jhadina/page.tsx`. Must selectively reconcile visual planner with later voice cancellation logic and new main work, not copy full page |
| Music discovery/player | PR #1408 | `/api/auth/youtube/*`, middleware and app/layout overlap Home/social. Playback authorization, rights, queues and persistence need independent acceptance |
| Music restoration | PR #1421 followed by #1422 | DB and worker commissioning remain blocked; do not introduce unauthorized model or real audio flows |

`main` was 2 commits ahead of the current JLLM visual head `0abea8e` at audit time. That PR's prior green checks do not cover this new branch. Existing source components from these PRs are NOT silently declared merged. The lab below explores owner experience, not production feature parity.

## .02 — Usable private mobile lab

New `apps/jhadina-web/public/jhadina-independent-lab.html` is a portrait-first, self-contained, accessible tabbed prototype with no third-party CSS/JS/fonts. It provides Home, Memory, Visual and Music tabs; large touch targets; safe-area padding; mobile-responsive cards; keyboard tab-switch navigation; and reduced-motion accommodation.

**Synthetic content is labeled on-screen.** No real provider accounts or users are represented.

## .03 — Owner-directed Memory review rehearsal

Sample writing cues implement keep/reject/edit/reset only in JS memory. Editing a previously selected cue immediately revokes its local selected state; reset restores the unedited sample. Nothing is posted to `/api/personality/facebook/propose` or persisted. Existing owner-only Facebook import remains governed by PR #1418 and real Safari ZIP provenance, not this demonstration.

## .04 — Visual and voice interaction rehearsal

A local range slider recomputes a fictional three-bar chart with accessible numeric values. A user-initiated native browser SpeechSynthesis sample can be started and cancelled, including on tab/page visibility changes. This is **not** an original speaker model, live JLLM generation, or proof of audio barge-in correctness. PRs #1414/#1417 remain the canonical sources of those real integrations.

## .05 — Music experience rehearsal

A fake three-track catalog supports case-insensitive search, explicit selection, next and stop. User-initiated Web Audio emits at most a one-second, quiet synthesized tone; it never fetches, buffers, streams, uploads or stores recorded music, YouTube results, Spotify assets, sessions or signed URLs. Inactive/hidden pages stop it. No music copyright or listening-history claim is implied. Real queue and playback remains in PR #1408.

## .06 — Narrow access control + regression

The bypass is allowed **only** if all are true:

1. exact route `/jhadina-independent-lab.html`;
2. method `GET` or `HEAD`;
3. `VERCEL_ENV=preview`;
4. `VERCEL_GIT_COMMIT_REF=feat/jh-independent-build-01-06-20261019`.

Production, branch mismatches, POST, neighboring paths and privileged API calls continue through existing Supabase Auth. Vercel project-level Authentication/SSO must remain enabled independently; this check does not replace it. Middleware adds `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow`. HTML CSP includes `connect-src 'none'`, forbids images/media loads, and makes no fetch requests. No non-preview bypass is offered.

**Test commands (before release):**
```bash
pnpm --filter @jhadina/jhadina-web exec vitest run \
  src/lib/supabase/independent-lab-policy.test.ts \
  src/lib/supabase/independent-lab-middleware.test.ts \
  src/lib/supabase/middleware.test.ts
pnpm --filter @jhadina/jhadina-web type-check
pnpm --filter @jhadina/jhadina-web build
```
Test suite includes exact branch/read method admission, other branches/deployments/neighbor routes denial, the no-Auth lab read, denial of POST and three sensitive APIs, and fixture no-network/no-persistence assertions. These checks are source tests, not proof of a real iPhone session or SSO protection.

## Pending operator-owned verification

1. Verify exact-head CI across all relevant workflows, ensure GitHub PR is draft until reviewed, and compare with newest `main`.
2. Verify private preview deployment's exact commit, `VERCEL_ENV`, Git ref and **Vercel SSO protection**. Never remove SSO to make the lab reachable.
3. On a physical iPhone in portrait mode: switch all four tabs, keyboard/screen reader, low motion, feed filters, keep/edit invalidation and reset, slider numeric labels, speech cancellation, Music search/select/next/tone/stop, background audio stops.
4. Keep the Facebook *real archive* importer on its separately protected reviewed URL; no real archive or owner writing belongs in this synthetic lab.
5. When SWLC recovers: independent SQL readiness, backups/RLS/ownership, migrations and Auth, and only then selective current-main reconciliation of PRs #1404/#1416, #1418, #1414/#1417 and #1408, followed by owner-session canaries.

**Status:** SOURCE IMPLEMENTED / CI AND PHYSICAL ACCEPTANCE TO BE VERIFIED / NO LIVE DB OR PRODUCTION CERTIFICATION.

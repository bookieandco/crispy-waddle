# Jhadina Work Queue

This file is the canonical source of truth for what Jhadina engineering work
is happening, in what order, and why. It replaces ad-hoc brainstorm threads
as the thing an agent (or a person) reads before doing anything.

## How this file is used

**When told `Next`:**
1. Read this file.
2. Find the task with `Status: ACTIVE`.
3. Finish it if possible; otherwise make the largest safe amount of progress.
4. Run the task's `Verification` commands for real — don't assume.
5. Update the task's status/notes in this file and commit that update.
6. If the task is DONE or BLOCKED, promote the next unblocked P0, then P1,
   task to ACTIVE (see "Selection order" below).
7. Stop and report using the completion format below. Stop *before* anything
   listed in a task's `Human gate` line — do that work up to the gate, then
   ask.

**When told `Blocked`:** report exactly what decision, credential, or
external configuration the current ACTIVE task needs, per its `Human gate`
line. Don't guess at a resolution.

**When told `Audit`:** stop implementation. Investigate the architecture
question raised, report findings, propose task updates to this file. Don't
write feature code during an audit.

**Selection order when promoting a new ACTIVE task:** lowest task ID among
unblocked P0s, then unblocked P1s, then P2s. "Unblocked" means every ID in
`Dependencies` is `DONE`. Never auto-promote a task whose `Human gate` line
would immediately be hit — surface it as the report's `NEXT` and stop.

## Lanes

- **FOUNDATION** — core spine, memory, governance, policy, execution
  boundaries, shared contracts, CI itself. Nothing here duplicates an
  existing contract.
- **INTEGRATION** — connecting an existing capability to the spine
  (Evolution Engine, JhadinaTV, communications, Shodan, Staffing,
  Money/Revenue, external connectors).
- **PRODUCT** — UX, Command Center, verticals, customer-facing features.
- **EXPERIMENT** — mining, new AI models, speculative integrations,
  research. Nothing here is authorized to become FOUNDATION or INTEGRATION
  without an explicit human decision recorded in this file. See
  `docs/DO_NOT_BUILD.md` for the hard boundaries on this lane specifically.

## Status values

`ACTIVE` (exactly one at a time) · `QUEUED` · `BLOCKED` · `REVIEW` · `DONE` · `SUPERSEDED`

## Completion report format

Every task ends with this, not a narrative, unless something genuinely
went wrong and needs explaining:

```
TASK: JH-###
STATUS: DONE / BLOCKED
CHANGED:
- ...
VERIFIED:
- tests
- lint
- build
- CI
ARCHITECTURAL IMPACT:
- ...
COMMIT: <sha>
NEXT: JH-###
```

---

## Inventory notes (as of this file's creation)

This queue was seeded from a full audit of the repository's 30 open PRs
(see the merge-order audit delivered in chat on 2026-08-13). Every open PR
maps to a task below, or to a note explaining why it doesn't need one yet
(pure-speculative items with no branch/code are not tasks — see
`docs/DO_NOT_BUILD.md` and the EXPERIMENT-lane notes).

Lane assignment for the ~18 vertical/product PRs (commerce, pupsonstuff,
staffing, placementos, etc.) is a first pass based on title and stated
scope only — those were not individually deep-audited for CI/conflict
state the way the FOUNDATION-lane items were. Treat their `Definition of
Done` as provisional until someone actually opens each one.

---

## FOUNDATION

### JH-001
**Priority:** P0
**Status:** DONE
**Branch:** `ci/launch-gate` (PR #42, merged `b8c2453`)
**Objective:** Get the repository-wide CI launch gate (install → type-check
→ lint → test → build, independent of Vercel) actually passing.
**Dependencies:** None
**Definition of Done:** Met. Root cause was `apps/jhadina-web` having no
app-level `tsconfig.json`, so `tsc` fell back to the root config and
pulled in unrelated, incomplete packages. Fixed alongside: the recurring
"Phase 1" bug set (wrong import paths, missing `listApproved`, a
`let desc = event.type` narrowing bug, `jest`-vs-`vitest` mismatch,
`privacy-core` missing a re-export); two premature integrations
(evolution-candidates API routes, workstation routes) referencing
`jhadina-evolution-core`/`director-core` packages that have no
`package.json` yet — removed rather than stubbed, since inventing their
internals is explicitly out of bounds; and three real `music-core` test
bugs (two float32/float64 comparison mistakes, one miscalibrated fixture
against an untouched threshold).
**Verification:** All five commands run for real, locally and in the
actual GitHub Actions run on PR #42 (`Install, type-check, lint, test,
build`: success). 57/57 tests passing.
**Next Step:** None — done.

### JH-002
**Priority:** P0
**Status:** DONE
**Branch:** `feat/jhadina-core-spine` (PR #25, merged `fbcbbaf`)
**Objective:** Merge the `@jhadina/core-spine` control-plane package
(evidence-backed contracts for memory, patterns, personality, context,
decisions, policy, actions, audit; governed orchestration that stops
denied decisions before execution).
**Dependencies:** JH-001
**Definition of Done:** Met. Same root cause as JH-001 hit again: the
package had no scoped `tsconfig.json`, so `tsc` pulled in unrelated
incomplete packages via the root config. Added
`packages/jhadina-core-spine/tsconfig.json` (scoped to its own `src/**`,
`moduleResolution: "bundler"` for its `.js`-extension ESM-style internal
imports) plus the missing `pnpm-lock.yaml` workspace importer entry.
Confirmed scope stayed to contracts/orchestration only — no domain
logic, external APIs, DELIA/MARISA, or DB changes.
**Verification:** Real CI on PR #25 after rebase onto the fixed `main`:
both `evolution-core` checks and the repo-wide `Install, type-check,
lint, test, build` gate all green.
**Next Step:** None — done.

### JH-003
**Priority:** P0
**Status:** DONE
**Branch:** `agent/evolution-core-spine-adapter` (PR #30, merged `fc5557f`)
**Objective:** Merge `@jhadina/evolution-core`'s `JhadinaEvolutionAdapter`
against the canonical `core-spine` `EvolutionPort` — proposal/evaluation
identity enforced at the adapter boundary, promotion delegated to a
governed promoter, no policy/executor bypass.
**Dependencies:** JH-002
**Definition of Done:** Met. Same tsconfig-scoping root cause hit a 4th
time — added `packages/jhadina-evolution-core/tsconfig.json`. The
reconciled `jhadina-evolution-core-ci.yml` (merge conflict between this
branch and `main`, both having added it independently) called
`pnpm --filter jhadina-evolution-core` / `... typecheck`, but the package
is named `@jhadina/evolution-core` with a `type-check` script — fixed
both. Deleted three orphaned files (`claude-github-actions-runner.ts`,
`evolution-repair-runtime.ts`, `supabase-evolution-candidate-repository.ts`)
that only imported modules that were never created and weren't exported
from `index.ts` or referenced anywhere else — same "delete, don't invent
the missing internals" precedent as JH-001. Fixed two stale test fixtures
(`evolution-run-ledger.test.ts` missing `version: "1"` and using an old
verification shape; `governed-promoter.test.ts` missing
`persistedLedgerVerifier`) to match the real types — test-only, no
production change. Regenerated `pnpm-lock.yaml` for the new
`@jhadina/core-spine` workspace dependency.
**Verification:** Real CI on PR #30: `Install, type-check, lint, test,
build` and `evolution-core` both green (Supabase Preview skipped, not
counted per the CI trust rule). Also `pnpm type-check`/`lint`/`test`/
`build` run locally across all packages.
**Next Step:** None — done.

### JH-004
**Priority:** P0
**Status:** SUPERSEDED
**Branch:** `feat/jhadina-core-spine` onto `agent/evolution-core-spine-adapter` (PR #31, closed not merged)
**Objective:** N/A — this PR was a rehearsal, not new work. Its entire
purpose was proving core-spine's commits apply cleanly on top of the
evolution-adapter branch.
**Dependencies:** JH-002, JH-003
**Definition of Done:** Met. PR #31 closed (not merged) with a comment
explaining its purpose was fulfilled by #25 (`fbcbbaf`) and #30
(`fc5557f`) both landing on `main`. SUPERSEDED — rehearsal PR; purpose
fulfilled by #25 + #30.
**Verification:** N/A
**Next Step:** None — done.

### JH-005
**Priority:** P1
**Status:** DONE
**Branch:** `feat/approval-receipt-boundary` (PR #33, merged `b0368d6`)
**Objective:** Preserve `approval_required` as a first-class decision;
require a verified, single-use, expiring approval receipt bound to
action ID/user ID/capability/fingerprint before `ActionExecutor` runs a
consequential action.
**Dependencies:** JH-001
**Definition of Done:** Met. Rebased cleanly onto `main` past #42/#25/#30
with no conflicts. `jhadina-action-core` (the package this PR touches)
has no `package.json` of its own, but is reached and type-checked
transitively through `music-core`'s existing relative import
(`../../jhadina-action-core/src/action-executor`), so the real launch
gate already covers it — no new tsconfig or workspace wiring needed.
Confirmed scope stayed to the 3 stated files (action-executor.ts,
approval-receipt.ts, security-core-action-policy.ts) — no UI, external
API, DB migration, or Evolution changes.
**Verification:** Real CI on PR #33 (its first-ever real run — previously
only a skipped Supabase-preview check): `Install, type-check, lint, test,
build` green. Also `pnpm type-check`/`lint`/`test`/`build` locally.
**Next Step:** None — done.

### JH-006
**Priority:** P1
**Status:** DONE
**Branch:** `feat/staffingos-standalone-boundary` (PR #24, merged `63bf6fb`)
**Objective:** Get the PostgreSQL-backed staffing payment idempotency/
transaction/reconciliation boundary CI-verified and conflict-free.
**Dependencies:** JH-001
**Definition of Done:** Met. The `main`-merge conflict was checked (per
this task's own note) and turned out to be pure drift, not an
architecture disagreement: both sides had independently written the
same idempotency-store logic, differing only in an implementation
detail — `main`'s side had a real lock-cleanup bug (comparing against
the wrong promise reference), so kept this branch's correct version.
6th occurrence of the tsconfig-scoping bug (`money-core`), plus a
missing root path-alias entry (`@jhadina/action-core` didn't match the
`jhadina-action-core` directory name) and a missing `src/index.ts`
barrel for `jhadina-action-core` — both needed before `money-core`
could even resolve its own dependency. Real bugs found once actually
type-checked: an `ActionRequest.requestId` vs `.id` field-name bug in
money-core, a stale/duplicate/incomplete `PostgresFinancialIdempotencyStore`
in staffing-core sitting unused next to the real, tested implementation
(deleted, not completed — same no-duplicate-implementations precedent
as PR #31), a missing `PostgresTimesheetStore.update()`, a missing
`BILLABLE` key in the timesheet transitions map, a missing
`apps/staffing-web/next.config.js` (workspace `.js`-extension imports
couldn't resolve) and `.eslintrc.json`, and 12 staffing-web API routes
importing nonexistent service factories from a `lib/staffing/*` module
that was never built — rewired to the same inline-construction pattern
already used by the one route that worked, using the real, already-complete
service classes rather than inventing new ones.
**Verification:** Real CI on PR #24: `Install, type-check, lint, test,
build`, `evolution-core`, and both `postgres-integration` runs all
green. Also reproduced the PR's own `staffing-postgres-integration.yml`
gate locally against a live Postgres 16 instance with migration 0022
applied, and the full `pnpm type-check`/`lint`/`test`/`build` repo-wide.
**Next Step:** None — done.

### JH-007
**Priority:** P1
**Status:** BLOCKED
**Branch:** `agent/jhadina-integration-spine` (PRs #13 and #15 — same
head commit, opened against two different bases)
**Objective:** N/A until the duplicate is resolved. #13 (based on the
Shotlist/DirectorOS branch, #8) explicitly says it should be "retargeted
to main" once #8 merges. #15 (based directly on `main`) is the same
commits framed more broadly as "Mission Control" — a unified home for
JANET/DELIA/MARISA/Safeguard/JEI/Music/Opportunity/Social/Money. Neither
PR has ever had a real build run (only a skipped Supabase-preview check)
despite being 6,557–7,047 line diffs across 114–123 files.
**Dependencies:** None technically, but decision-blocked.
**Human gate:** Which PR is the intended scope — the narrower
DirectorOS-integration framing (#13) or the broader Mission-Control
framing (#15)? This is a product-scope call, not a mechanical merge
decision, and I'm not going to guess given the size of the diff.
**Definition of Done:** One of the two PRs closed with a note; the
survivor gets real CI coverage before merge given its size.
**Verification:** Full `pnpm test`/`lint`/`build`/CI once scope is decided.
**Next Step:** Ask Dorian which framing is intended.

---

## INTEGRATION

### JH-008
**Priority:** P1
**Status:** DONE
**Branch:** `feat/jhadinatv-casting-boundary-live4` (PR #36, merged `d4bd7a3`)
**Objective:** Investigate before anything else: this PR is titled as
"add casting boundary" and its body describes a small, additive change
(transport-agnostic `MediaSession` contracts, a "Watch on TV" button),
but the actual diff is **+703 / −3980 across 18 files, 49 commits** — far
more deletion than the stated scope implies. Its `jhadinatv` CI check is
also failing.
**Dependencies:** None
**Definition of Done:** Met. Diff review found this branch was stacked
directly on PR #35's tip commit (not on `main`), and the diff tool was
comparing against `main` — misleading. ~3,809 of the ~3,980 deleted
lines were `pnpm-lock.yaml` optional-platform esbuild entries (lockfile
shrinkage from regeneration); the remaining 176 were a legitimate
reorganization of `jhadina-tv-core`'s monolithic `index.ts` into
`casting.ts`/`catalog.ts`/`media-session.ts`/`providers.ts`/`cast/*.ts`.
No accidental damage. Rebased onto current `main`, retargeted the PR
from `feat/jhadinatv-streaming-module` to `main` (so it merges into the
right branch), and fixed real bugs the scoped tsconfig exposed for the
first time: a filename/import mismatch, two DOM-typing narrowing errors
in `picture-in-picture.ts`, an off-by-one relative-import depth bug, and
an unescaped-apostrophe hard ESLint error under `next build`.
**Verification:** Real CI on PR #36 (retargeted to `main`): launch-gate,
`jhadinatv`, `evolution-core`, and `postgres-integration` all green.
Also `pnpm type-check`/`lint`/`test`/`build` locally, including the new
`/jhadinatv` and `/jhadinatv/watch/[kind]/[id]` routes statically
generating.
**Next Step:** None — done.

### JH-009
**Priority:** P2
**Status:** SUPERSEDED
**Branch:** `feat/jhadinatv-streaming-module` (PR #35, closed not merged)
**Objective:** Merge the JhadinaTV catalog/media boundary foundation
(`packages/jhadina-tv-core`, explainable recommendation scoring,
governed media-source-adapter contract, discovery/watch-page shell).
Playback is explicitly behind an HTTPS source-adapter contract — no
scraping/proxying of unverified third-party streams.
**Dependencies:** JH-001
**Definition of Done:** Met via JH-008. PR #36 was built directly on top
of this PR's tip commit, so every file this PR touched was already an
ancestor of #36's branch; merging #36 to `main` carried this PR's full
content along with it (confirmed via diff: `main` is a strict superset
of this branch, nothing missing). SUPERSEDED — closed without merging,
purpose fulfilled by #36.
**Verification:** N/A
**Next Step:** None — done.

### JH-010
**Priority:** P1
**Status:** DONE
**Branch:** `agent/shotlist-director-core-repaired` (PR #45, merged
`79300f2`) — reconstructed from `feat/jhadina-shotlist-director-integration`
(PR #8, closed not merged, branch untouched/recoverable)
**Objective:** Merge the provider-neutral Director/Shotlist Core —
persistence-free creative-intent/prompt-emission/scene-timeline/
production-gate logic, with policy/approval/execution/audit/memory
remaining owned by the spine.
**Dependencies:** JH-001
**Definition of Done:** Met, via a reconstruction rather than a direct
merge. Dorian's instruction: treat the deletions as accidental damage
unless PR #8's own history proved otherwise, reversing the burden of
proof onto the unverified branch rather than the already-merged
`security-core`/DSP `music-core` infrastructure. Archaeology (not
guessing): the original "PR #8 deletes security-core + 30 music-core
DSP files" finding was an artifact of diffing against `450c8b5`
(GitHub's reported base sha), which is **not actually an ancestor** of
PR #8's branch (`git merge-base --is-ancestor` fails). The real
merge-base is `a6d85a3`; at that commit neither package existed yet on
`main` (`security-core` added later at `8005a69`, DSP `music-core` at
`9e51ee9`, both confirmed descendants of `a6d85a3`). Zero commits in
PR #8's 103-commit history touch either path — it never deleted
anything, it's a stale branch that forked before `main` grew those
packages. The real diff (`a6d85a3..065a1b2`) is 72 files, +3732/−1,
entirely additive: `packages/planning-core`, `packages/shotlist-core`,
`apps/jhadina-agent-runtime`, `apps/jhadina-calendar-kmp`, a handful of
`jhadina-web` routes/components — none touching `music-core`, so the
two "generations" of that package already coexisting on `main` were
never a real collision. Applied that diff directly onto current `main`
(`git apply --check` — zero conflicts) as a new branch, entirely
independent of PR #8's stale history; PR #8 itself was never touched
(no commits, no force-push) and was only closed, not deleted, after
#45 merged. Fixed real bugs the packages' own type-checker/build had
never caught (no prior real CI run): `PlanningEventBus.publish()`
wasn't generic despite every event-factory function returning a
concretely-typed event; a few unused imports/fields; a test calling a
3-arg constructor with 1 arg; the app's first real App Router page
needed a root `layout.tsx` and a `Suspense` boundary for
`useSearchParams()`; scoped tsconfigs and missing scripts for the two
new packages. `apps/jhadina-agent-runtime` has no `package.json` (not
yet a real workspace member) — left as-is, not invented.
**Verification:** Real CI on PR #45: launch-gate, `jhadinatv`,
`evolution-core`, and `postgres-integration` all green. Also `pnpm
type-check`/`lint`/`test`/`build` locally, plus an explicit isolated
check that `SecurityCoreActionPolicy` still resolves through the real
`security-core` implementation, unaffected.
**Next Step:** None — done.

### JH-011
**Priority:** P2
**Status:** DONE
**Branch:** `feat/jhadina-social-core` (PR #5, closed not merged — content already
live on `main`)
**Objective:** Connect Jhadina Social Core to Hootsuite.
**Dependencies:** JH-001
**Definition of Done:** Met — turned out to already be met before this task
started. This PR is stacked on `fix/vercel-build-jhadina-web` (PR #4)
partway through PR #4's own 65-commit history (missing PR #4's later 39
commits). Isolating this PR's own unique diff against its real stacking
point (not PR #4's baggage) showed exactly 8 files: `packages/social-core/*`
(Hootsuite provider, brand config, types) and two API routes
(`api/social/posts`, `api/social/profiles`). Every one of those was
already present on `main` — semantically identical, just Prettier-
reformatted, first landed independently at `2fde1da` (2026-08-09).
Nothing to merge. Closed PR #5 without merging per the duplicate-PR
rule. The rest of PR #4/#5's combined diff (`BottomNav.tsx`,
`pages/index.tsx`, growth/money/film features) belongs to PR #4
(JH-016), not this task, and was left untouched.
**Bug found during verification, fixed separately (PR #46, `fbbfe2d`):**
confirming the Hootsuite routes actually worked surfaced that
`apps/jhadina-web` had BOTH a root `app/` and a `src/app/` directory —
Next.js silently uses root `app/` and drops `src/app/*` entirely when
both exist, which had made every route under `src/app/*` (health,
memories, memory/approve, memory/reject, message, candidates, music/*,
placement/*, settings, and both social routes) unreachable in every
real build this whole session, undetected because
`apps/jhadina-web/tsconfig.json`'s `include` never covered root `app/`
either. Confirmed pre-existing (reproduced on the commit before JH-010
touched anything) — moved root `app/`'s small content into `src/app/`
and removed the redundant root directory. Also fixed a genuine missing
`@jhadina/planning-core` barrel export the move exposed.
**Verification:** Real CI on PR #46: launch-gate and `postgres-integration`
both green. `pnpm type-check`/`lint`/`test`/`build` (forced, no cache)
locally — every route, including both social routes, now appears in
the real build's route manifest.
**Next Step:** None — done.

### JH-012
**Priority:** P3
**Status:** QUEUED (DISCOVER complete — nothing to land)
**Branch:** none
**Objective:** Shodan read-only security connector
(`shodan.host.read`, `shodan.internetdb.read`, `shodan.dns.read`,
`shodan.search.read`, `shodan.history.read`), adapter-bounded, evidence
not conclusions, no active scanning.
**Dependencies:** JH-001, JH-002
**DISCOVER result (2026-08-13):** Searched all 32 remote branches, by
both content (`git grep -i shodan`) and path
(`packages/{jhadina-action-core,provider-core,security-core}`). `shodan`
appears nowhere except this queue file. `packages/jhadina-action-core`
already exists and is merged to `main` (from earlier queue work); no
`provider-core` or `security-core` package exists anywhere in any
branch. This is a from-scratch build with no existing implementation to
audit or land, against infrastructure (`provider-core`, `security-core`)
that itself doesn't exist yet.
**Next Step:** Not started — genuinely no code exists for this task.
Building a live external security-scanning connector (even read-only)
from a brainstorm description, with no existing `provider-core`/
`security-core` boundary to adapt into, is a product/security decision
(what gets scanned, whose Shodan API key, what evidence surfaces where)
that shouldn't be started implicitly. Left QUEUED pending a human call
on priority and design.

### JH-013
**Priority:** P3
**Status:** QUEUED (DISCOVER complete — nothing to land)
**Branch:** none
**Objective:** "Communications stack" end-to-end wiring (Command API →
Policy → Planner → Comms Core → Transport Registry → Reticulum Adapter →
Reticulum, and the inbound/evidence paths back).
**Dependencies:** JH-001, JH-002
**DISCOVER result (2026-08-13):** Searched all 32 remote branches for
every named component, by path and by content. `reticulum` appears
nowhere except this queue file. The only path match for any of
"transport-registry / comms-core / communication-planner / command-api
/ device-identity-registry" is `packages/placement-core/src/command-api.ts`
on `main` and two PlacementOS-adjacent branches — PlacementOS's own
command API (a staffing/scheduling domain), unrelated to a
communications/mesh-networking stack. None of the actual named
components (Communications Core, Communication Planner, Transport
Registry, Reticulum Adapter, Device/Identity Registry) exist anywhere.
**Next Step:** Confirmed purely conceptual — this is not implemented on
any branch this session has access to. Not something to start from a
brainstorm description alone; needs a human decision on whether it's
still a real planned feature before it gets a Definition of Done.

---

## PRODUCT

### JH-014
**Priority:** P1
**Status:** DONE
**Branch:** `feat/supabase-auth-protected-routes` (PR #6, merged `d4ead67`)
**Objective:** Add Supabase Auth and protected routes.
**Dependencies:** JH-001
**Verification:** `pnpm test`, `pnpm lint`, `pnpm build`, CI — all green
(`Install, type-check, lint, test, build`, `evolution-core`,
`postgres-integration`, `jhadinatv`).
**Completion report:**
```
TASK: JH-014
STATUS: DONE
CHANGED:
- apps/jhadina-web/src/lib/supabase/{client,server,middleware}.ts (new)
- apps/jhadina-web/src/middleware.ts (new)
- apps/jhadina-web/src/app/login/{page.tsx,actions.ts} (new)
- apps/jhadina-web/src/app/auth/confirm/route.ts (new)
- apps/jhadina-web/src/app/auth/signout/route.ts (new)
- apps/jhadina-web/package.json — merged both sides' new deps
  (@jhadina/tv-core from main, @supabase/ssr + @supabase/supabase-js
  from PR #6)
- Deleted apps/jhadina-web/src/app/page.tsx (PR #6's placeholder auth
  demo page) — see ARCHITECTURAL IMPACT
VERIFIED:
- Real merge-base with main confirmed as a6d85a3 (not GitHub's reported
  base sha); real diff matched PR #6's own stated size exactly
  (274/-1, 11 files) — no scope creep
- tsc --noEmit, eslint, vitest, next build all pass for jhadina-web,
  planning-core, shotlist-core (forced/no-cache)
- Real GitHub Actions CI green on PR #6 before merge
ARCHITECTURAL IMPACT:
- PR #6 introduced apps/jhadina-web/src/app/page.tsx targeting the same
  `/` route as the already-merged, substantive
  apps/jhadina-web/pages/index.tsx (PersonalCommandFeed homepage),
  producing a hard Next.js build failure ("Conflicting app and page
  file"). Applied the same reversed-burden-of-proof principle used for
  JH-010: pages/index.tsx is established, CI-verified product content;
  the PR's page.tsx was an unverified branch's placeholder demo page
  with no other references anywhere in the codebase. Deleted the
  placeholder, kept pages/index.tsx as canonical `/`. Confirmed the
  middleware's route matcher protects `/` regardless of which router
  serves it, so this does not regress the auth objective — all other
  PR #6 infrastructure (middleware, login, signup/login actions, email
  confirmation, signout) is intact and unchanged.
COMMIT: c115fdf (pushed to PR #6), merged as d4ead67
NEXT: JH-015
```

### JH-015
**Priority:** P1
**Status:** DONE
**Branch:** `agent/growth-engine-slice` (PR #47, merged `8229dce`).
Original `feat/jhadina-growth-engine` (PR #7) left open/untouched —
see deferred tasks JH-025–JH-031 below.
**Objective:** Growth Engine redraft workflow — draft lifecycle with
explicit approval gate, redraft/approve/reject/schedule endpoints,
Growth Command Center UI. Provider-neutral: publishing stays a separate
layer behind the approval gate.
**Dependencies:** JH-014 (done — merged to main).
**Verification:** `pnpm test` (41/41), `pnpm lint` (0 errors), `pnpm build`,
CI (`Install, type-check, lint, test, build` — green).
**Completion report:**
```
TASK: JH-015
STATUS: DONE
CHANGED:
- apps/jhadina-web/src/lib/growth/{types,engine}.ts (new)
- apps/jhadina-web/src/app/api/growth/drafts/{route,approve,reject,
  redraft,schedule}/route.ts (new)
- apps/jhadina-web/src/app/growth/page.tsx (new)
VERIFIED: type-check, lint, test (41/41), build (incl. new /growth
route) all pass locally; real CI green on PR #47.
ARCHITECTURAL IMPACT:
- Human gate resolved: option (b) — land only the scoped Growth
  Engine slice (8 files, self-contained, no dependency on anything
  else new in PR #7), reconstructed as a fresh branch/PR (#47) off
  current main rather than merging PR #7 itself. PR #7
  (feat/jhadina-growth-engine) is fully preserved, untouched, still
  open — none of its ~200 deferred files were lost or silently
  dropped, they're filed below as JH-025–JH-031.
- Notable: PR #7's history independently hit the exact same
  pages/index.tsx vs app/page.tsx collision resolved in JH-014, and
  resolved it the opposite way (kept the Supabase placeholder, deleted
  pages/index.tsx as "legacy" — see commit 8b96d19 on that branch).
  That resolution is NOT part of what merged here. If JH-031 (shell
  navigation, below) is ever picked up, it must reconcile with the
  already-merged JH-014 decision explicitly, not inherit PR #7's
  deletion via automatic git merge.
COMMIT: 8229dce
NEXT: JH-016
```

### Deferred from PR #7 (filed per JH-015's resolution, not yet audited)

PR #7 (`feat/jhadina-growth-engine`) bundled the following alongside
the actual Growth Engine feature. None of it merged. Each is filed
here as its own QUEUED item so it's tracked rather than silently
accepted or silently dropped, per
`docs/DO_NOT_BUILD.md`'s "capability that goes straight from 'sounds
useful' to 'implemented' without a branch, a task in the work queue,
and a Definition of Done" smell — every one of these was implemented
without ever going through DISCOVER → AUDIT → ACCEPT. All still live
only on `feat/jhadina-growth-engine` (PR #7); none has its own branch
yet.

### JH-025
**Priority:** P2
**Status:** SUPERSEDED
**Branch:** `feat/jhadina-growth-engine` (PR #7) — `packages/growth-core/**`
**Objective:** Standalone attribution/creative-brief/customer-LTV/
economics/experiments/lineage engine (20 files, own package.json).
**Resolution:** Folded into and completed by JH-021 (PR #52, merged
`d6efd2e`) — PR #41 turned out to contain the exact same 30 files
(byte-identical, diffed to confirm) plus 26 more finishing the
package with full test coverage. Landed as one task rather than
landing this narrower slice first and completing it later. See
JH-021's completion report.

### JH-026
**Priority:** P2
**Status:** BLOCKED
**Branch:** `feat/jhadina-growth-engine` (PR #7) —
`apps/jhadina-studio-native/**`, `apps/jhadina-web/src/lib/studio/**`,
`services/{wav2lip,physics-service,rig-service,tracking-service,
studio-mastering}/**`
**Objective:** Studio AI-actor/video pipeline — GPU video processing,
character DNA/appearance/behavior runtime, physics, lip-sync,
voice-sync, rig/tracking, native Swift AV code, and five new Python
microservices.
**Dependencies:** JH-001
**Human gate:** By far the largest and most speculative of the
deferred surfaces — native mobile code plus multiple new deployable
services. Given `docs/JHADINA_WORK_QUEUE.md`'s EXPERIMENT lane rule
("nothing here is authorized to become FOUNDATION or INTEGRATION
without an explicit human decision"), this needs a human call on lane
placement and deployment/infra implications before any implementation
work, not just a merge-order audit. Explicitly left BLOCKED
(2026-08-13) rather than promoted — evidence above stays as-is until
that decision is made.
**Next Step:** Await human scoping decision, then DISCOVER/AUDIT.

### JH-027
**Priority:** P2
**Status:** DONE
**Branch:** `agent/publishing-engine` (PR #53, merged `0664435`).
Original PR #7 left open/untouched (shared source for other still-
deferred tasks).
**Objective:** Publishing engine — fiction/creative-writing workflow,
KDP intelligence, research library and engine.
**Dependencies:** JH-001
**Completion report:**
```
TASK: JH-027
STATUS: DONE
CHANGED:
- apps/jhadina-web/src/lib/publishing/{creative-writing-workflow,
  fiction-engine,kdp-intelligence,publishing-intelligence,
  publishing-workbench,publishing-world,research-engine,
  research-library}.ts (new, 8 files)
- apps/jhadina-web/src/components/publishing/{PublishingWorkbench.tsx,
  .module.css} (new)
- apps/jhadina-web/src/lib/jhadina/jhadina-world-registry.ts (new) —
  pulled in as a required direct dependency (publishing-intelligence.ts
  imports its JhadinaWorldId type); small, zero-import, self-contained,
  not claimed by any other deferred task.
- Fixed 2 real bugs surfaced by actually type-checking (not present
  in any deferred task, genuine defects in the reconstructed files):
  PublishingWorkbench.tsx's dead 'Library' tool-name comparison, and
  jhadina-world-registry.ts's untyped tuple array.
VERIFIED:
- All 10 core files + the 1 dependency file grepped for fetch/
  credentials/secrets/bearer/http(s):// — nothing found.
- kdp-intelligence.ts read in full: pure types + deterministic
  factories (crypto.randomUUID(), timestamp), createKdpAutomationJob()
  defaults publish-adjacent operations to requiresApproval-gated
  status. No live Amazon KDP integration anywhere.
- PublishingWorkbench.tsx's persistence is client-side
  window.localStorage only — no network calls.
- type-check, lint, test (41/41), build all pass; CI green on PR #53.
ARCHITECTURAL IMPACT:
- No human/security gate needed — same governed/dormant-until-wired
  pattern as JH-019/020/021. Nothing here is mounted to a page/route.
- Confirmed (again) that the remainder of PR #7's diff is the
  already-tracked kitchen-sink content from JH-015/019/021/025-039 —
  not re-deferred, not re-merged.
COMMIT: 796dede (PR #53), merged as 0664435
NEXT: JH-028 (flagged — real Plaid financial data, needs its own
audit before promoting; see JH-028)
```

### JH-028
**Priority:** P2
**Status:** BLOCKED
**Branch:** `feat/jhadina-growth-engine` (PR #7) —
`apps/jhadina-web/src/lib/money/{needsAttentionEngine,
plaidFinancialData}.ts`, `apps/jhadina-web/src/app/money/command-center/page.tsx`,
`apps/jhadina-web/src/app/api/money/financial-data/route.ts`
**Objective:** Plaid-backed financial snapshot provider and
needs-attention engine, wired to a money command-center page.
**Dependencies:** JH-001
**Human gate:** Full audit completed (2026-08-13) — read every file,
traced UI → API route → provider → (no further boundary). Findings:

- `needsAttentionEngine.ts` is safe: a pure, deterministic function
  (snapshot in, ranked `AttentionItem[]` out), zero I/O, zero side
  effects, and marks every bill/card/subscription item
  `requiresApproval: true`. Not wired to the command-center page yet
  (dormant). No concern here.
- `command-center/page.tsx` is safe: read-only rendering, one `GET`
  fetch, no form/button anywhere that submits a payment, transfer,
  withdrawal, or cancellation. Its own copy states the boundary
  explicitly ("without receiving permission to move money... Payments,
  transfers, withdrawals, and cancellations remain separate approval
  actions").
- `plaidFinancialData.ts` and its API route are the real finding.
  This makes **genuine, live, credentialed** calls — not mocked, not
  dormant — to `https://{sandbox,production}.plaid.com/accounts/balance/get`
  and `/transactions/get` using `process.env.PLAID_ACCESS_TOKEN` /
  `PLAID_CLIENT_ID` / `PLAID_SECRET` read directly inline. Both Plaid
  endpoints called are read-only (no `/transfer/*` or
  `/payment_initiation/*` — confirmed no money-movement endpoint is
  called anywhere in this file), and no PLAID_* vars are documented
  anywhere in the repo, so it is inert by default until someone
  provisions real credentials. The API route
  (`api/money/financial-data/route.ts`) has **no auth check of its
  own** — it inherits protection only incidentally, because JH-014's
  repo-wide middleware (matcher covers all non-static paths, redirects
  unauthenticated requests to `/login`) happens to also cover this
  path. That protection is real today but is not this feature's own
  design — nothing here would fail closed if the middleware were ever
  scoped differently.
- **The actual blocker**: `packages/money-core` already has a
  properly governed Plaid integration —
  `PlaidReadOnlyAdapter` (`plaid-read-only-adapter.ts`), which
  implements the `BankAdapter` interface, calls
  `assertCapability(context, 'money.account.read')` before every read,
  resolves credentials through `credential-resolver.ts` (never reads
  `process.env.PLAID_*` directly — verified via repo-wide grep,
  zero hits in money-core), and has its own test file. This is
  established, CI-verified FOUNDATION infrastructure (landed via
  JH-006). `plaidFinancialData.ts` is a second, parallel, ungoverned
  Plaid client that duplicates it while bypassing every governance
  mechanism the sanctioned one has: no capability check, no
  credential-resolver, no shared test coverage, no `BankAdapter`
  contract. This is exactly the "second registry / second
  implementation" architectural smell `docs/DO_NOT_BUILD.md` calls out
  by name — "the actual task is almost always 'wire this into the
  existing one,' not 'build a parallel one.'"
- Per the reversed-burden-of-proof principle applied throughout this
  cleanup pass: `packages/money-core`'s adapter is the established,
  governed implementation; `plaidFinancialData.ts` is the unverified
  branch content, and it hasn't demonstrated a reason to bypass the
  existing governance layer rather than use it. Not landing
  `plaidFinancialData.ts`/its route as-is. Whether the right fix is
  (a) rewrite the command-center's data path to call
  `PlaidReadOnlyAdapter` through the capability boundary instead, (b)
  something else, is a call for a human to make, not something to
  guess at silently — same treatment as JH-026.
**Next Step:** Await human decision on how the command-center's data
path should reach Plaid (via `packages/money-core`'s governed adapter,
most likely, but not decided here). `needsAttentionEngine.ts` and the
UI shell are safe and could land separately once wired to a
governed data source.

### JH-029
**Priority:** P2
**Status:** DONE
**Branch:** `agent/opportunities-shopping-cooking` (PR #54, merged
`5ab2476`). Original PR #7 left open/untouched.
**Objective:** Shopping watchlist, cooking/recipe/drink recommendation
engines, and an Opportunity Command Center (side-income discovery with
an approve-only, no-side-effect action model).
**Dependencies:** JH-001
**Completion report:**
```
TASK: JH-029
STATUS: DONE
CHANGED:
- apps/jhadina-web/src/lib/opportunities/{sideIncome,engine}.ts,
  src/app/opportunity/page.tsx, src/app/api/opportunities/{route,
  approve/route}.ts, src/__tests__/opportunities.test.ts (existing
  10-test vitest coverage carried over)
- apps/jhadina-web/src/lib/shopping/universal-shopping.ts,
  src/lib/awareness/shopping-watchlist.ts
- apps/jhadina-web/src/lib/cooking/{drink-recommendations,
  recipe-ingestion}.ts
- apps/jhadina-web/src/lib/flow/context-flow.ts (direct dependency,
  small/self-contained, not claimed by any other deferred task)
- Fixed one real type-narrowing bug in drink-recommendations.ts
  (property narrowing lost across a closure) — behavior unchanged.
VERIFIED:
- Full grep sweep across all 11 files for fetch/credentials/secrets/
  bearer/http(s):// — nothing beyond the app's own internal
  /api/opportunities* routes. Every "source" field (shopping,
  recipes) is caller-supplied input, never fetched by this code.
- No path to Action Executor anywhere; the only server-tracked
  mutation in the whole slice is approveOpportunity(), an in-memory
  status flip with a timestamp — no money movement, no purchase, no
  booking, no publishing.
- type-check, lint, test (51/51), build all pass; CI green on PR #54.
ARCHITECTURAL IMPACT:
- No human/security gate needed — decision-support/observation only
  throughout, matching the pattern already established for
  JH-019/020/021/027.
- Confirmed (again) the rest of PR #7 is the already-tracked
  kitchen-sink content from JH-015/019/021/025-028/030-039 — not
  re-deferred, not re-merged.
COMMIT: d2048c1 (PR #54), merged as 5ab2476
NEXT: JH-030
```

### JH-030
**Priority:** P2
**Status:** DONE
**Branch:** `agent/campaign-polling` (PR #55, merged `eeeb228`). Original
PR #7 left open/untouched.
**Objective:** Polling intelligence dashboard.
**Dependencies:** JH-001
**Completion report:**
```
TASK: JH-030
STATUS: DONE
CHANGED:
- apps/jhadina-web/src/lib/campaign/polling.ts (new): summarizePolls()
  — sample-weighted average, recent-vs-older trend direction,
  poll-count-based confidence tier, low-sample warning.
- apps/jhadina-web/src/app/campaign/polls/page.tsx (new): renders
  static demo poll data through summarizePolls(). No API route.
VERIFIED:
- Grep sweep for fetch/credentials/secrets/bearer/http(s):// across
  both files: nothing. No external polling-data source, no write
  path, no action execution anywhere in this slice.
- type-check, lint, test (51/51), build all pass; CI green on PR #55.
ARCHITECTURAL IMPACT: None — descriptive/evidence-only, matches the
pattern already established for JH-019/020/021/027/029.
COMMIT: 122dcd3 (PR #55), merged as eeeb228
NEXT: JH-031 (human gate already on file — homepage collision with
JH-014, do not auto-promote)
```

### JH-031
**Priority:** P2
**Status:** DONE
**Branch:** `jh031-shell-chrome` (PR #57, merged `6c7cf00` — reconstructed from
`feat/jhadina-growth-engine` PR #7's
`JhadinaShellNavigation.tsx`/`MiniPlayer.tsx`/`layout.tsx`)
**Objective:** Five-button shell navigation (with a "Worlds" dropdown)
and a persistent JhadinaTV mini player, mounted as chrome around every
route.
**Dependencies:** JH-001, JH-014
**Human decision (2026-08-13):** Homepage/shell architecture resolved
— PersonalCommandFeed (JH-014) remains the content and behavioral
owner of `/`; JH-031 may add navigation, chrome, and the JhadinaTV
mini-player, but may not replace, fork, or rewrite the homepage. (Same
decision closed out JH-036 and JH-042 as homepage-replacement
candidates — see those entries.)
**Completion report:**
```
TASK: JH-031
STATUS: DONE
CHANGED:
- src/components/JhadinaShellNavigation.tsx + .module.css: five-button
  bottom nav + Worlds dropdown, route list trimmed to what actually
  exists on main today (original pointed at /money/command-center,
  /ask-jhadina, /activity, /film, /social, /trucker, /cooking,
  /shopping, /radar, /knowledge — none landed yet).
- src/components/jhadinaTv/MiniPlayer.tsx: copied as-is, self-contained,
  renders null without a src (no live stream source exists yet —
  mounted but dormant).
- src/app/layout.tsx: mounts nav + mini player around App Router pages.
- pages/_app.tsx (new): same chrome mounted for the Pages Router routes
  (/, /jhadinatv, /jhadinatv/watch/[kind]/[id]) — App Router and Pages
  Router are separate trees with separate root shells in Next.js.
- Deliberately excluded PR #7's UniversalJhadinaButton: depends on a
  command-bus/command-context runtime that doesn't exist anywhere on
  main. Left as a follow-on, not invented here.
VERIFIED:
- pages/index.tsx and PersonalCommandFeed.tsx confirmed byte-for-byte
  unchanged (diffed against main).
- pnpm type-check/lint/test/build for jhadina-web all clean; 51/51
  tests passing (unchanged); real build confirms every route,
  including / at 86.2 kB (up from 82.5 kB — new chrome JS, expected).
ARCHITECTURAL IMPACT:
- Resolves the homepage-collision human gate additively — no vertical's
  existing route or component was touched.
COMMIT: 4dafe4c (PR #57), merged as 6c7cf00
NEXT: next unblocked task per selection order
```

### JH-016
**Priority:** P1
**Status:** SUPERSEDED
**Branch:** `fix/vercel-build-jhadina-web` (PR #4, closed without merging)
**Objective:** Unblock the Jhadina web Vercel build.
**Dependencies:** None
**Completion report:**
```
TASK: JH-016
STATUS: DONE (superseded, no merge needed)
CHANGED: none — nothing merged.
VERIFIED:
- True merge-base with main is 408a2f8 (matches the PR's own stated
  claim, unlike several earlier PRs' misleading reported base).
- PR #4's stated fix (music-core tsconfig path mapping, GEMINI_API_KEY
  turbo globalEnv) is fully superseded: main's apps/jhadina-web/tsconfig.json
  already has a generic "@jhadina/*" path mapping (from JH-006), and
  GEMINI_API_KEY has zero references anywhere in the current codebase.
- Confirmed via real build (JH-014, JH-015) that main already builds
  clean without any of PR #4's changes.
ARCHITECTURAL IMPACT:
- Same over-bundling pattern as JH-015/PR #7: stated scope is a tiny
  config fix, real diff is 43 files across five unrelated, unqueued
  domains (see JH-032–JH-036 below), including an alternate homepage
  that collides with JH-014's already-merged pages/index.tsx decision
  the same way JH-031 does. None of it merged. PR #4 closed (not
  merged) with an explanatory comment; branch/history preserved on
  GitHub.
COMMIT: none
NEXT: JH-017
```

### Deferred from PR #4 (filed per JH-016's resolution, not yet audited)

### JH-032
**Priority:** P2
**Status:** PARTIALLY DONE — trend-scouting/ideas slice merged (PR #59,
`cd844a4`); redraft/version model BLOCKED on explicit human decision
**Branch:** `jh032-growth-trend-scout` (PR #59, merged) — reconciled
from `fix/vercel-build-jhadina-web` (PR #4)
**Human decision (2026-08-13):** Confirmed keep blocked — the
linked-draft vs. numbered-version redraft models are a real data-model
choice; do not merge either by accident. The already-landed
trend-scouting portion stands independently and needed no further
action.
**Objective:** A third, more elaborate Growth Engine generation —
trend scouting, idea generation, agent-reach provider, scheduling —
built on the same `types.ts`/`engine.ts` shape as JH-015 but
substantially extended.
**Dependencies:** JH-001, JH-015
**Audit (2026-08-13):** JH-025 is SUPERSEDED (folded into JH-021's
landed `growth-core`, not a live "third generation" — queue reference
was stale). The real fork is between JH-015's landed `engine.ts` and
this branch's: both evolved a `redraftGrowthDraft` independently and
incompatibly — main's creates a new linked draft
(`parentDraftId`/`redraftInstruction`); this branch's does actual
keyword-based text transformation and tracks numbered versions
(`versionOf`/`version`). `trendScout.ts`/`trendScoutWorker.ts`/
`webTrendProvider.ts`/`agentReachProvider.ts`/`scheduler.ts` and the
`ideas`/`trends/scout` API routes don't depend on that fork at all —
landed as PR #59 (pure trend-observation/proposal pipeline, dormant-
by-default provider adapters, no engine.ts changes). Only
`api/growth/drafts/versions/route.ts` (depends on the source branch's
version-tracking functions) was left out.
**Next Step:** Human call needed on which `redraftGrowthDraft`/
versioning model is canonical before `drafts/versions/route.ts` (or
any engine.ts merge) can land — same category of decision as JH-046,
not a git-mechanical merge.

### JH-033
**Priority:** P2
**Status:** BLOCKED (same axis as JH-028 — reconcile before either
becomes a real financial surface)
**Branch:** `fix/vercel-build-jhadina-web` (PR #4) —
`apps/jhadina-web/src/lib/money/{financialAttention,
financialDataProvider,plaidAdapter}.ts`,
`apps/jhadina-web/src/app/money/{command-center,withdraw}/page.tsx`
**Objective:** Plaid-backed financial data/attention engine plus a
money command-center and withdrawal page.
**Dependencies:** JH-001
**Audit (2026-08-13):** Read every file in full. This is a *different
and safer* implementation than JH-028's, not the same one from another
branch generation — important distinction, since the queue previously
assumed equal risk:
- `plaidAdapter.ts`: pure normalizer only — no `fetch`, no Plaid API
  call, no credentials anywhere in the file.
- `financialDataProvider.ts`: an abstract `FinancialDataProvider`
  interface (`getSnapshot(): Promise<FinancialSnapshot>`) plus pure
  helpers (`creditUtilization`, `toFinancialAttention`) — no concrete
  Plaid (or any) implementation at all.
- `financialAttention.ts`: pure sort/action-shaping functions.
- `command-center/page.tsx` on **this** branch is a different
  implementation than JH-028's page of the same name/route — this one
  renders hardcoded demo seed data (`seed: FinancialAttention[]`), has
  **no fetch call anywhere**, and its "One-click review" button only
  calls a local, pure `createApprovalAction()` ("Prepared... Pending
  your approval; no money moved"). JH-028's version of this same route
  is the one that fetches live data from the ungoverned Plaid client.
- `withdraw/page.tsx` imports `requestWithdrawal` from
  `@/lib/music/moneyCoreWithdrawal.ts` (JH-034's domain, not in this
  task's original file list — pulled in as a direct dependency). That
  function only ever creates a `PENDING_APPROVAL` request object; it
  never executes a transfer (see JH-034 below for the full read). The
  page's own hardcoded `available=0` means any real submission would
  fail closed with "Withdrawal exceeds available balance" as shipped.

So JH-033, as written, is safety-clean top to bottom — the risk here
isn't a live governance-bypassing client (that's specifically JH-028's
`plaidFinancialData.ts`), it's that this is a **second, independent
UI/interface design for the identical `/money/command-center` route**,
demo-data-only and not wired to `money-core`'s governed
`PlaidReadOnlyAdapter` either. Landing this alongside or instead of
JH-028 would still leave two competing "what does the money command
center look like and where does its data come from" answers.
**Next Step:** Human call, same as JH-028: which design (or a merge of
JH-033's cleaner `FinancialDataProvider` abstraction with money-core's
already-governed `PlaidReadOnlyAdapter` as its concrete implementation)
becomes the one canonical `/money/command-center`. Not decided here.

### JH-034
**Priority:** P2
**Status:** BLOCKED (safety-clean, but not wired to real `money-core`
— park with JH-033/JH-028 pending the one-canonical-path decision)
**Branch:** `fix/vercel-build-jhadina-web` (PR #4) —
`apps/jhadina-web/src/lib/music/{distribution,distributionAdapter,
moneyCoreBridge,moneyCoreWithdrawal,royaltyLedger,
royaltyStatementImporter}.ts`,
`apps/jhadina-web/src/app/music/{release-center,royalties}/page.tsx`
**Objective:** Music distribution and royalty-ledger domain, bridged
to `money-core`, including a withdrawal path.
**Dependencies:** JH-001, JH-006 (money-core)
**Audit (2026-08-13):** Read every file (also read as JH-033's direct
dependency). All five `lib/music/*.ts` files here are pure — grepped
for `fetch(`/`process.env`/`API_KEY`/`Authorization` across all of
them, zero matches. Specifically:
- `moneyCoreWithdrawal.ts`: `requestWithdrawal()` only ever constructs
  a `PENDING_APPROVAL` request object; `approveWithdrawal()` only
  flips status to `APPROVED`. Neither executes a transfer — the file's
  own comment states it explicitly: "External transfer execution
  remains a separate, explicitly authorized step." No
  `executeWithdrawal`/send-money function exists anywhere in it.
- `moneyCoreBridge.ts`: `toMoneyCoreTransaction()`/
  `allocateConfirmedIncome()` are pure shaping/allocation functions.
  Despite the name, this file does **not** import or call
  `packages/money-core` at all — it produces a `MoneyCoreTransaction`-
  shaped object but has no real integration with the actual package.
  "Bridged to money-core" is aspirational naming, not a real wire-up.
- `distribution.ts`, `distributionAdapter.ts`, `royaltyLedger.ts`,
  `royaltyStatementImporter.ts`: no external calls found in any of
  them (not read line-by-line for full business-logic correctness,
  but confirmed no I/O surface).

So there's no live-execution or credential-handling risk here — the
DO_NOT_BUILD money-movement concern doesn't apply to what's actually
in these files today. The real gap is that "bridged to money-core" is
currently just naming; making it a genuine bridge (calling the real
`@jhadina/money-core` package, e.g. through its
`TransactionWriteHandler`/`PaymentProvider` contracts) is exactly the
"one canonical Money data path" work the JH-028/JH-033 decision needs
to resolve first — building a second, parallel bridge here before that
decision lands would just add a third money-adjacent surface.
**Next Step:** Park alongside JH-028/JH-033. Once the canonical
money-core integration path is decided, `moneyCoreBridge.ts`'s
allocation logic and `moneyCoreWithdrawal.ts`'s request/approve state
machine are both safe, reusable pieces to wire into it — just not
ahead of that decision.

### JH-035
**Priority:** P2
**Status:** REJECTED (not landing — duplicates already-landed,
richer infrastructure)
**Branch:** `fix/vercel-build-jhadina-web` (PR #4, closed without
merging; history preserved)
**Objective:** Film planning / scene-extension logic. Scope and
intended UI surface unclear — no page/route wires to these in the
diff.
**Dependencies:** JH-001
**Audit (2026-08-13):** Both files read in full (148 lines total,
genuinely small). Both are pure — no fetch, no credentials, no I/O;
`SceneExtendProvider`/`PremiereSequenceAdapter` are unimplemented
interfaces, not concrete adapters. Safety isn't the issue; overlap is:
- `filmPlanner.ts`'s `FilmPlan`/`FilmScene`/`FilmShot` (a simple
  scene→shots-with-duration/prompt/status model) duplicates
  `packages/shotlist-core`'s already-landed `Shot` type — richer in
  every dimension (`projectId`, `sceneScriptOrder`, `ordinal`,
  `shotType`, `angle`, `lensMm`, `movement`, `durationSec`, `action`,
  `emotion`, `lighting`, `audioNote`, `entityHandles`, `status`,
  `DirectorControls`), plus the surrounding `production.ts`/
  `scene-adapters.ts`/`director-modules.ts`/`jhadina-adapter.ts`
  ecosystem already built around it.
- `sceneExtend.ts`'s `SceneContinuityPacket`/`createSceneExtendJob` (a
  standalone "extend a clip with a continuity packet" concept)
  duplicates `packages/director-core`'s already-landed continuity
  system: `timeline-model.ts`'s `GenerativeOperation` already includes
  `'extend'`, plus a full `ContinuityLock`/`ContinuityManifest`/
  continuity-QC-and-ranking pipeline (`continuity-qc.ts`,
  `candidate-ranking.ts`, `batch-ranking-action-adapter.ts`) and
  `shotlist-core`'s own `createMultiViewContinuityProvider`/
  `priorTakeId`/`priorClipUri` tracking — all more sophisticated than
  this file's simple packet-passing approach.

Neither file is consumed by any page/route on its own branch either
(confirmed — matches the queue's original note). Per the reversed
burden of proof, the already-landed, richer shotlist-core/director-core
infrastructure is presumed correct; this smaller, standalone
reinvention isn't additive.
**Next Step:** None. If film-planning UI is wanted later, it should be
built against `shotlist-core`'s `Shot`/`DirectorControls` and
`director-core`'s continuity/extend system, not this file pair.

### JH-036
**Priority:** P2
**Status:** REJECTED (not landing)
**Branch:** `fix/vercel-build-jhadina-web` (PR #4, already closed
without merging via JH-016; history preserved)
**Objective:** Alternate homepage — a `BottomNav`-driven feed (Music /
Opportunity / Jhadina cards), rewriting `pages/index.tsx` from its
then-current trivial "Loading..." placeholder.
**Dependencies:** JH-001, JH-014
**Human decision (2026-08-13):** Homepage/shell architecture resolved
in JH-031's favor — PersonalCommandFeed remains the canonical `/`.
This branch's BottomNav feed was an alternate homepage built before
PersonalCommandFeed existed, not a reasoned rejection of it. Not being
landed; its underlying PR was already closed via JH-016 for unrelated
reasons.
**Next Step:** None.

### JH-017
**Priority:** P2
**Status:** DONE
**Branch:** `agent/pupsonstuff-foundation` (PR #48, merged `9b83f00`).
Originals #9/#10/#11/#12/#14 closed without merging, history preserved.
**Objective:** Integrate the PupsonStuff boutique vertical (product
engine, mobile stage, print-on-demand core).
**Dependencies:** JH-001
**Completion report:**
```
TASK: JH-017
STATUS: DONE (foundation only — see JH-037/038/039 for the rest)
CHANGED:
- apps/pupsonstuff/** (new, 159 files): 3D boutique + per-product
  viewers, AI preview routing (OpenAI/Muapi/ASCII), animation preview,
  read-only admin dashboard, audited GLB assets, Printify fulfillment
  client (lib/printify.ts, spec-derived).
- .github/workflows/pupsonstuff-ci.yml (new, ported from #9)
- apps/pupsonstuff/.eslintrc.json (new — didn't exist)
- root package.json: pnpm.packageExtensions for @react-three/fiber,
  @react-three/drei, framer-motion, next
- root README.md: pupsonstuff added to the apps/ tree listing
VERIFIED:
- Real git archaeology across all 5 PRs (true merge-base d1e9024 for
  all, not GitHub's reported 450c8b5): #14 is the actual linear trunk;
  #9 is a squash-recovery of #14@Milestone-7 with one unique file
  (the CI workflow, ported forward); #10/#11 are parallel siblings
  forking mid-#14-trunk, not a chain; #12 stacks only on #11.
- type-check, lint, build all pass for @jhadina/pupsonstuff, both
  locally and via real CI (both the path-scoped "Type-check and build
  PupsonStuff" check and the main "Install, type-check, lint, test,
  build" gate green).
- apps/jhadina-web's React 18 type-check re-verified unaffected by the
  packageExtensions change.
ARCHITECTURAL IMPACT:
- Landed #14's trunk as the canonical PupsonStuff foundation. #10
  (interactive engine layer), #11 (mobile product stage + live Stripe
  checkout), and #12 (POD core + print quality gate + a second,
  colliding Printify client) were deliberately NOT included — #10/#11
  substantially rewrite established components rather than adding to
  them, #11 introduces real payment collection, and #12's Printify
  client duplicates #14's own more complete one. Filed as JH-037/038/039
  rather than silently merged or silently dropped.
- Diagnosed and fixed a real (not pupsonstuff-specific) monorepo
  infrastructure gap: @react-three/fiber, @react-three/drei,
  framer-motion, and next don't declare @types/react as an explicit
  dependency, so in this shared-workspace-lockfile monorepo (mixed
  React 18/19 across apps) their bundled .d.ts fell through to the
  repo-wide hoisted 18.x types, breaking tsc program-wide with
  "X cannot be used as a JSX component" on unrelated files. Fixed via
  scoped pnpm.packageExtensions, verified not to affect React-18 apps.
COMMIT: 0c73849 (PR #48), merged as 9b83f00
NEXT: JH-018
```

### Deferred from PupsonStuff #10/#11/#12 (filed per JH-017's resolution, not yet audited)

PR #9, #10, #11, #12, and #14 are all now closed without merging
(JH-017 landed #14's trunk + #9's one unique file as PR #48; #10/#11/#12
were never merged anywhere). Their branches and history remain on
GitHub. #10/#11/#12's real content is filed below rather than lost.

### JH-037
**Priority:** P2
**Status:** REJECTED (not landing)
**Branch:** `feat/pupsonstuff-engine-v5` (PR #10, closed without
merging; history preserved)
**Objective:** Reusable deterministic interaction contract
(`lib/interactive-experience.ts`) plus an `InteractiveExperienceLayer`
component — product focus/orbit/AR-style interaction, ambient
feedback, mobile HUD.
**Dependencies:** JH-001, JH-017
**Audit (2026-08-13):** The true merge-base with current `main`
(`d1e9024`) predates `main`'s `ProductModal.tsx` entirely — main's
current version (523 lines: real 3D view switching, `/api/generate-
preview` + `/api/animate-preview` integration, retry/error states,
variant/quantity selection, approve workflow — all functioning, all
already shipped) doesn't exist yet at that fork point. This branch's
own `ProductModal.tsx` is a 143-line stub from *before* all of that
was built, not an evolution of it. Applying it would delete the AI
generation/3D/animation integration users already have — a regression,
not a feature. `InteractiveExperienceLayer.tsx` (109 lines) is a
self-contained alternate mobile UI mockup, not wired to
`ProductModal.tsx` or anything else — its "Preview" button has no
click handler, its style-swatch buttons only set local state. Not
consuming any existing governed capability, just a disconnected,
non-functional shell from an earlier iteration.
**Next Step:** None. `lib/interactive-experience.ts` (a small, pure
interaction-profile config contract) is technically safe in isolation,
but nothing consumes it — landing an unconsumed utility module isn't
worth the queue overhead. If a real need for tunable 3D-interaction
profiles on top of the already-shipped `Product3DEngine` shows up
later, revisit then rather than landing speculative infrastructure now.

### JH-038
**Priority:** P2
**Status:** SPLIT — component rewrite REJECTED, checkout route BLOCKED
**Branch:** `feat/pupsonstuff-mobile-stage` (PR #11, closed without
merging; history preserved)
**Objective:** Mobile product studio — tap-to-open spring-animated
foreground product view, pet-photo upload + AI preview generation via
the existing `/api/generate-preview`, Product/Artwork view switching.
Also adds `app/api/checkout/route.ts` — a live Stripe Checkout Session
(real payment collection, customer-initiated).
**Dependencies:** JH-001, JH-017
**Audit (2026-08-13):** Same true merge-base as JH-037 (`d1e9024`,
pre-dates main's current pupsonstuff app). `Product3DEngine.tsx`
(main: 213 lines / branch: 99), `Boutique.tsx` (179 / 116), and
`generate-preview/route.ts` (163 / 59) are all earlier, smaller
versions than what's already shipped on `main` — applying them would
regress already-working functionality, same as JH-037. **Rejected.**
`app/api/checkout/route.ts` is genuinely new (doesn't exist on `main`
in any form) and is a real, live Stripe Checkout Session: reads
pricing from the server-side `hotspots` data (not client-supplied —
good), clamps quantity 1-20, fails closed with a 503 if
`STRIPE_SECRET_KEY` isn't set, never auto-charges (customer-initiated,
one Checkout Session per request). But `packages/payment-core` and
`packages/checkout-orchestrator` already define a provider-agnostic
`PaymentProvider`/`CheckoutSession` contract for exactly this — and
neither has any concrete implementation anywhere in the repo (`grep
"new Stripe("` across the entire codebase matches nothing but this
branch). This would be the first concrete payment-provider
implementation in the repo, built as a raw, app-local Stripe call
instead of a `PaymentProvider` implementation behind `payment-core` —
the same "second/first implementation bypassing the governed contract"
shape as JH-028's Plaid finding.
**Next Step:** Human call needed on the same axis as JH-028/033: does
PupsonStuff's checkout wrap `payment-core`'s `PaymentProvider`
interface (making it the reference implementation other verticals
route through), or is a simpler app-local integration acceptable given
payment-core has no consumers yet either? Not decided here — do not
land the raw Stripe route until that's settled.

### JH-039
**Priority:** P2
**Status:** SPLIT — quality-gate/workflow slice DONE (PR #60, merged
`ae2d716`); Printify duplication + fulfillment-spend path BLOCKED
**Branch:** `jh039-pod-quality-workflow` (PR #60, merged) — reconciled from
`feat/pupsonstuff-pod-core` (PR #12, closed without merging)
**Objective:** Print-on-demand core — product-specific print profiles,
deterministic image quality scoring, a server-side quality-check
endpoint, and a Printify provider boundary (`lib/pod/*`: catalog sync,
AI job/worker, quality gate, Supabase-backed job workflow, webhooks).
**Dependencies:** JH-001, JH-017, JH-038
**Audit (2026-08-13):** Read all 19 `lib/pod/*` files. Landed the pure,
dependency-free slice as PR #60: `workflow.ts` (job-stage state
machine — `customer_approval` always precedes `provider_upload`/
`order_created`, no path reaches Printify submission without it),
`quality-gate.ts` (deterministic image scoring), `image-qa.ts` (pure
`evaluateArtwork` only — dropped its Supabase-writing counterpart,
see below), `events.ts`/`automation.ts` (pure typing/dispatch
shaping). 11 new tests; pupsonstuff had no test script at all before
this, added one.

Confirmed and left blocked: `lib/pod/{printify,printify-client,
printify-fulfillment}.ts` duplicates the Printify integration already
landed via JH-017 (`apps/pupsonstuff/lib/printify.ts`, 637 lines,
`submitOrder`/`sendOrderToProduction` already implemented,
`PRINTIFY_API_KEY` server-side only). `lib/pod/printify-client.ts` is
a second, raw fetch-based order client with its own hand-rolled auth
header — the "second implementation" pattern, not a git-mechanical
merge question. The valuable new logic (`assertProductionReady`/
`assertFulfillmentGate` — customer approval + quality score ≥ 90
required) should call JH-017's existing client, not its own duplicate.
Also: `pupson_pod_jobs`/`pupson_creation_assets` (referenced by
`ai-job.ts`/`ai-worker.ts`/`supabase-operations.ts`/the webhook route)
have no migration anywhere in this repo — those files weren't audited
this pass and can't be verified end-to-end without that schema either.
**Next Step:** Human call needed on the Printify-client reconciliation
(same shape as JH-028/JH-038's payment-provider question) and the
missing schema, before any of the remaining `lib/pod/*` files or real
production/fulfillment spend can land.

### JH-018
**Priority:** P2
**Status:** DONE
**Branch:** `agent/capital-lab-ui` (PR #49, merged `5b25950`). Original
`feature/capital-lab-ui` (PR #3) closed without merging, history
preserved.
**Objective:** Jhadina Capital Lab mobile UI.
**Dependencies:** JH-001
**Completion report:**
```
TASK: JH-018
STATUS: DONE
CHANGED:
- apps/jhadina-web/src/lib/capital-lab/client.ts (new) — read-only
  Money Core snapshot fetch (MONEY_CORE_URL)
- apps/jhadina-web/src/components/capital-lab/{CapitalLabPanel.tsx,
  index.ts,capital-lab.css,README.md} (new) — the panel UI, not yet
  mounted into a page/route
- root package.json: extended pnpm.packageExtensions (from JH-017) to
  next@14.2.35 and next@15.5.23's @types/react-dom
VERIFIED:
- Real diff against true merge-base (c286b843, not GitHub's reported
  450c8b5): 5 files, fully additive, no deletions, no collisions with
  main.
- Read the component/client code directly: no credentials, no
  transfer/withdrawal submission logic — Send/Withdraw are
  capability-gated disabled buttons, the action sheet's only handler
  is onClose. Confirmed safe against the payment/policy scrutiny
  established for other money-adjacent tasks this pass.
- type-check, lint, test (41/41), build all pass for jhadina-web; CI
  green including the PupsonStuff path-scoped check.
ARCHITECTURAL IMPACT:
- Surfaced and fixed a real, pre-existing infra fragility: this
  shared-workspace-lockfile monorepo's hoisted @types/react-dom
  fallback is NOT deterministic across separate `pnpm install` runs
  from the identical lockfile (reproduced: two fresh installs hoisted
  18.3.7 and 19.2.4 respectively). next@14.2.35 (jhadina-web's own
  Next version) has the same "doesn't declare @types/react-dom itself"
  gap JH-017 fixed for pupsonstuff's next@15.5.23 — it just hadn't
  been hit by unlucky hoisting yet. Extended the same
  pnpm.packageExtensions mechanism to both next versions explicitly;
  verified across a repeated fresh install that neither app depends on
  the hoisted fallback anymore.
COMMIT: 5cde33a (PR #49), merged as 5b25950
NEXT: JH-019
```

### JH-019
**Priority:** P2
**Status:** DONE
**Branch:** `agent/entertainment-intelligence-core` (PR #50, merged
`0cb6ff8`). Original `feat/jhadina-entertainment-intelligence` (PR #16)
left open/untouched — see deferred tasks JH-040–JH-045 below.
**Objective:** Entertainment intelligence feature.
**Dependencies:** JH-001
**Completion report:**
```
TASK: JH-019
STATUS: DONE
CHANGED:
- packages/jhadina-entertainment-core/** (new): governed JEI
  creative-learning core — observation -> feedback -> taste
  hypothesis -> approval -> creative context. Self-contained, no
  external calls/credentials.
- Added standard scaffolding not present in the original PR: scoped
  tsconfig.json, type-check/test scripts, vitest devDependency;
  wrapped the original bare-assert test in a vitest test() block
  (same assertions, unchanged logic) since vitest reported "No test
  suite found" without it.
VERIFIED:
- Real diff against true merge-base (463e769, not GitHub's reported
  base): 116 commits / 75 files. Read every changed file and
  classified each as required/dependency/unrelated/superseded — see
  ARCHITECTURAL IMPACT.
- type-check and test pass for @jhadina/entertainment-core; CI green
  on PR #50; apps/jhadina-web and apps/pupsonstuff re-verified
  unaffected.
ARCHITECTURAL IMPACT:
- PR #16's branch name undersold its real scope by roughly the same
  margin as JH-015/JH-016/JH-017. Only packages/jhadina-entertainment-core
  (6 files) matches "entertainment intelligence" as a finished,
  tested, self-contained deliverable. Landed that; deferred six other
  surfaces as JH-040–JH-045 rather than merging or dropping them
  silently — see those entries for detail. Two are flagged for
  security/policy review (live GitHub API credentials; a FOUNDATION
  package touch), one collides with the JH-014 homepage decision, one
  overlaps JH-014's auth work, and two justice/entertainment
  "continuation" packages are unfinished (no package.json, unwired).
COMMIT: bb172f9 (PR #50), merged as 0cb6ff8
NEXT: JH-020
```

### Deferred from PR #16 (filed per JH-019's resolution, not yet audited)

PR #16 (`feat/jhadina-entertainment-intelligence`) bundled the
following alongside the actual entertainment-intelligence feature.
None of it merged; all of it still lives only on that branch. Filed
here per `docs/DO_NOT_BUILD.md`'s "implemented without a branch, a
task in the work queue, and a Definition of Done" smell, same as
JH-025–JH-039.

### JH-040
**Priority:** P2
**Status:** DONE
**Branch:** `jh040-entertainment-graph` (PR #61, merged `cd09e0d`) — reconciled from
`feat/jhadina-entertainment-intelligence` (PR #16)
**Objective:** A second, more ambitious entertainment-intelligence
surface built as a direct continuation of JH-019's core (same author,
same day, immediately following commits): creative knowledge graph
(nodes/relations with evidence + provenance), a reference-match engine,
a creative review/feedback-calibration engine, and music audio-feature
perception (converting measurements into creative observations).
**Dependencies:** JH-001, JH-019
**Completion report:**
```
TASK: JH-040
STATUS: DONE
CHANGED:
- Determined this genuinely EXTENDS JH-019's @jhadina/entertainment-core
  rather than competing with it: JH-019's domain.ts/engine.ts already
  own the observation -> feedback -> taste-hypothesis -> approval
  boundary. The branch's graph/reference/review/perception modules are
  a different concern (relationship graph between creative works +
  matching/calibration on top of it) with zero type-name collisions.
  Landed inside the EXISTING @jhadina/entertainment-core package as
  new modules, not as a second top-level package — one entertainment
  core, several capabilities.
- src/graph/{types,creative-knowledge-graph}.ts,
  src/reference/reference-match-engine.ts,
  src/review/{creative-review-engine,review-feedback,review-events}.ts,
  src/perception/music/audio-features.ts.
- Deliberately excluded perception/music/observation-builder.ts: it
  imports CreativeObservation from a domain/observation.ts that
  doesn't exist anywhere on the source branch, and its object literals
  use field names incompatible with JH-019's real CreativeObservation
  type even if repointed — a genuine gap in the source branch itself.
- Fixed one real scaffolding gap: this package's tsconfig didn't
  override the root's ES2020 lib, so the new files'
  String.prototype.replaceAll() (ES2021) didn't type-check.
VERIFIED:
- pnpm type-check clean; 7/7 tests passing (1 existing + 6 new). All
  new files confirmed pure (no fetch/process.env/credentials). No
  downstream consumers yet — dormant.
ARCHITECTURAL IMPACT:
- One entertainment-core package, not two. No competing boundary.
COMMIT: df2f28f (PR #61), merged as cd09e0d
NEXT: next unblocked task per selection order
```

### JH-041
**Priority:** P2
**Status:** BLOCKED (human gate — three incompatible evidence models,
no unilateral canonical pick)
**Branch:** `feat/jhadina-entertainment-intelligence` (PR #16, closed
without merging) — `packages/jhadina-justice-core/**`,
`packages/justice-core/**`, `apps/jhadina-web/src/lib/justice/**`,
`apps/jhadina-web/src/lib/services/JanetJusticeContextProvider.ts`
(direct dependency, not in the original file list — see below),
`docs/JHADINA_JUSTICE_CORE.md`
**Objective:** Legal/justice evidence domain — jurisdiction-aware
evidence contracts, an evidence store with verification pipeline, a
persistent Supabase-backed schema with RLS, an authority resolver, and
a verified evidence-packet boundary.
**Dependencies:** JH-001
**Audit (2026-08-13):** Read all three implementations in full, plus a
fourth file discovered as a direct dependency
(`JanetJusticeContextProvider.ts`, imported by `JanetContextProvider.ts`/
`JanetService.ts` — JANET's actual consumer-side hook for justice
context, currently defaulted to a safe no-op
`EmptyJanetJusticeContextProvider`). Confirmed: zero of the three
implementations import or reference each other; each contributes a
different, non-overlapping piece of what would need to be one
coherent pipeline:
- `packages/jhadina-justice-core` (has `package.json`, real workspace
  member): pure types + `JusticeEvidenceProvider.search()` (interface
  only, no implementation) + `JUSTICE_SOURCE_REGISTRY` (a static
  catalog of external legal-data repositories — statedecoded,
  citation-regexes, statedb, etc. — documentation, not live calls) +
  `validateJusticeFinding()`, a pure guardrail (rejects unverified
  citations, jurisdiction mismatches, expired evidence, and hard-
  requires `isLegalAdvice: false`). This is the **source-discovery**
  layer — nothing else has one.
- `packages/justice-core` (no `package.json`, orphaned like JH-040
  originally was): `JusticeEvidenceStore`/`InMemoryJusticeEvidenceStore`/
  `JusticeEvidenceVerifier` + a real Supabase migration
  (`justice_sources`/`justice_evidence`/`justice_verifications`, RLS
  enabled, `anon`/`authenticated` explicitly revoked — safe as
  written). This is the **persistence** layer — nothing else has one.
- `apps/jhadina-web/src/lib/justice/*`: the most sophisticated of the
  three. `JusticeAuthorityResolver.resolveJusticeAuthorities()` ranks
  evidence by authority level and explicitly refuses to silently pick
  a winner when same-rank authorities conflict (returns
  `unresolvedConflicts` instead, with a full `reasoningTrace`);
  `JusticeEvidencePacket.buildVerifiedJusticeEvidencePacket()` filters
  to verified/jurisdiction-matching/date-valid evidence and marks
  `INSUFFICIENT_EVIDENCE` rather than fabricating an answer from
  partial evidence. This is the **conflict-resolution and packet**
  layer. Its field shapes (`authorityLevel`/`verificationState`/
  `contentHash`/`provenance`) line up closely with
  `JanetJusticeContextProvider.ts`'s `JanetJusticeEvidenceReference`
  type — the only one of the three with a matching downstream JANET
  consumer already built, even though nothing wires them together yet.

So this isn't three redundant copies of the same thing — it's three
different, incompatible **type systems** for the same domain, each
owning a different real piece (discovery / persistence / resolution),
with no shared `JusticeEvidence` shape between them. Reconciling that
into one pipeline is genuine design work with real-world stakes
(evidence provenance, jurisdiction handling, what counts as
"verified," how conflicting authorities get surfaced rather than
silently resolved) — not a mechanical merge.
**Next Step:** Human call needed on which type system becomes
canonical (most likely: `apps/jhadina-web/src/lib/justice/*`'s
resolver/packet shapes as the spine, since JANET's own consumer
already expects that shape, with `jhadina-justice-core`'s discovery
registry and `justice-core`'s Supabase schema adapted to match) —
or a from-scratch redesign if none should win outright. Not decided
here.

### JH-042
**Priority:** P2
**Status:** QUEUED (narrowed — homepage-rewrite portion rejected)
**Branch:** `feat/jhadina-entertainment-intelligence` (PR #16, already
closed without merging; history preserved) —
`apps/jhadina-web/{app,lib}/agents/**`, `apps/jhadina-web/src/lib/agents/**`,
`apps/jhadina-web/src/app/api/{agents,system/status}/**`,
`apps/jhadina-web/app/api/system/activity/route.ts`,
`apps/jhadina-web/pages/activity.tsx`,
`packages/delia-core/src/quant/market-research.ts`,
`packages/director-core/**`
**Objective:** Delia/Marisa/Janet agent operating-loop runtime, a
system-status API, and a new `/activity` page surfacing it.
**Dependencies:** JH-001
**Human decision (2026-08-13):** Homepage/shell architecture resolved
in JH-031's favor — PersonalCommandFeed remains the canonical `/`. The
part of this bundle that rewrote
`apps/jhadina-web/components/home/PersonalCommandFeed.tsx` into a
system-status board is rejected, same as JH-036. The rest of the
bundle — the agents/** operating-loop runtime, the system-status API,
and a standalone `/activity` page (as a new route, not a homepage
replacement) — is not itself a homepage proposal and remains a
legitimate, separately-auditable candidate task.
**Next Step:** Not yet audited as a standalone slice. If picked up,
scope it to the agents/system-status/activity surfaces only — do not
touch `PersonalCommandFeed.tsx` or `pages/index.tsx`. Also note some
paths here are under root `apps/jhadina-web/app/` and `lib/` (not
`src/app/`/`src/lib/`) — re-check the app/vs src/app collision class
from JH-011 before assuming these routes are reachable as authored.

### JH-043
**Priority:** P2
**Status:** BLOCKED (human gate — live external credential, no
governed boundary)
**Branch:** `feat/jhadina-entertainment-intelligence` (PR #16, closed
without merging) —
`apps/jhadina-web/app/api/janet/codebase/route.ts`,
`apps/jhadina-web/src/lib/janet/memory/**`,
`apps/jhadina-web/src/lib/services/{JanetCodebaseIndex,
JanetContextProvider,JanetGitHubCodebaseProvider,
SupabaseCodebaseIndexStore}.ts`, `apps/jhadina-web/supabase/migrations/
20260810150000_codebase_graph.sql`, `docs/JHADINA_OPERATING_SYSTEM_AUDIT.md`
**Objective:** JANET codebase-context memory — indexes and scores this
repository's own source against an objective, backed by a Supabase
graph schema.
**Dependencies:** JH-001
**Audit (2026-08-13):** Full read. `JanetGitHubCodebaseProvider.ts`
itself is reasonably careful: read-only (`git/trees` + `contents` —
no write/webhook endpoints), refuses to proceed on a truncated tree
rather than silently indexing partial data, bounds file count/size,
and takes its token as constructor-injected config rather than reading
`process.env` internally. The Supabase migration
(`janet_codebase_{indexes,nodes,edges}`) enables RLS on all three
tables and defines **no policies at all** — Postgres's default-deny
means nothing is readable/writable except via service-role; safe as
shipped, just also unusable until policies exist.

The actual finding is the route, not the provider:
`app/api/janet/codebase/route.ts` reads `GITHUB_TOKEN`/`GH_TOKEN`
directly from `process.env` inline and hands it to the provider with
**no auth check of its own** — the same "inherits protection only
incidentally from middleware, not by its own design" shape flagged for
JH-028's API route, except this one triggers live, credentialed calls
to a third-party API (GitHub) keyed off a client-supplied `objective`
query parameter, with no capability check, no credential-resolver, and
no rate/abuse limiting beyond the file-count cap. It's also under root
`apps/jhadina-web/app/` rather than `src/app/` — main has no root
`app/` directory today, so this route isn't reachable as authored
without reintroducing the app-router collision class JH-011 already
resolved.
**Next Step:** Stays behind its security boundary, per the standing
rule for external credentialed connectors (same category as JH-026).
The eventual path should be JANET → a governed connector → a scoped
GitHub capability (through `security-core`'s `authorize()`/capability-
grant primitives, already real and landed) → evidence/index →
memory/context — not a route reading a raw token from `process.env`
with no gate. Not decided or built here.

### JH-044
**Priority:** P2
**Status:** DONE
**Branch:** `jh044-action-identity-verifier` (PR #58, merged `ebdf0b4`
— reconciled from `feat/jhadina-entertainment-intelligence` PR #16)
**Objective:** Server-side request-identity resolution and Supabase
session verification.
**Dependencies:** JH-001, JH-014
**Completion report:**
```
TASK: JH-044
STATUS: DONE
CHANGED:
- src/lib/auth/supabase-identity-verifier.ts: SupabaseActionIdentityVerifier,
  adapting verified Supabase claims (sub/session_id) to
  jhadina-action-core's ActionIdentityVerifier contract. Different
  layer than JH-014's middleware (page-route gate vs. per-action
  identity gate for VerifiedActionExecutor) — complementary, not
  duplicative.
- src/lib/application/createJhadinaApplication.ts (+test): composition
  root wiring the verifier alongside the already-landed JanetService/
  MemoryRepository/ReasoningEventRepository/TimelineRepository.
  execution.status stays 'not_configured' — honest placeholder, not a
  fake-ready executor.
- src/lib/auth/request-identity.ts: reconciled to reuse JH-014's
  existing createClient() (src/lib/supabase/server.ts) instead of the
  original PR's second, near-duplicate server-client constructor — one
  Supabase server-client boundary, not two. Normalizes the real
  SupabaseClient.auth.getClaims() shape down to the narrow
  SupabaseClaimsClient contract the verifier needs.
- Fixed two real bugs the first-ever type-check of these files
  surfaced: the test file's bare describe/it/expect (missing vitest
  import) and an unsound type cast.
VERIFIED:
- pnpm type-check/lint/test/build for jhadina-web all clean. 54/54
  tests passing (51 existing + 3 new).
- Does not touch src/lib/supabase/{client,server,middleware}.ts or any
  existing route.
ARCHITECTURAL IMPACT:
- One Supabase server-client boundary maintained; adds the missing
  action-identity layer jhadina-action-core's VerifiedActionExecutor
  needs, without creating a second auth implementation.
COMMIT: 67956a0 (PR #58), merged as ebdf0b4
NEXT: next unblocked task per selection order
```

### JH-045
**Priority:** P2
**Status:** DONE
**Branch:** `jh045-action-executor-hardening` (PR #56, merged `b236753`
— original `feat/jhadina-entertainment-intelligence` (PR #16) diff was
against a version of `action-executor.ts` that predates JH-005's
`approval_required` policy work and could not be applied directly).
**Objective:** Harden `ActionExecutor.execute`: fail closed if the
"started" audit-log append itself fails, and never convert a
successful side effect into a reported failure just because the
completion-audit append afterward failed.
**Dependencies:** JH-001, JH-005
**Completion report:**
```
TASK: JH-045
STATUS: DONE
CHANGED:
- packages/jhadina-action-core/src/action-executor.ts: split the
  post-handler try/catch. A successful handler result is no longer
  reported as 'failed' just because the completion-audit append
  afterward throws (now surfaces as a distinct
  ACTION_COMPLETED_AUDIT_FAILED error instead). If the handler fails
  AND the 'failed'-status append also fails, the original handler
  error is preserved (ACTION_FAILED_AND_AUDIT_FAILED) instead of being
  silently replaced (a JS catch-block footgun). Documented that the
  started-audit append was already fail-closed.
- packages/jhadina-action-core/{package.json,tsconfig.json} (new):
  this package had neither — invisible to turbo, its own test files
  never ran in CI, tsc never checked it standalone. Added standard
  scaffolding matching money-core's pattern.
- packages/jhadina-action-core/src/action-executor.test.ts (new): 5
  tests covering fail-closed-on-started-failure, successful-action-not-
  reported-as-failed, healthy-path, handler-failure-recorded, and
  double-failure-preserves-original-error.
- packages/jhadina-action-core/src/production-action-executor.test.ts:
  fixed one real pre-existing type error the new scaffolding's
  type-check surfaced (mock rpc() not generic to match AuditRpcClient).
VERIFIED:
- pnpm type-check: all 19 workspace packages clean, including
  money-core (consumes this package via the @jhadina/action-core path
  alias).
- pnpm test/lint: 13/13 tasks passing; jhadina-action-core went from 4
  untested files to 9 passing tests across 5 files.
- pnpm build for jhadina-web and action-core.
ARCHITECTURAL IMPACT:
- Surgical fix to a shared FOUNDATION package's error-handling only —
  no interface or caller-facing behavior changes beyond the two error
  paths described above.
COMMIT: 28dd361 (PR #56), merged as b236753
NEXT: next unblocked task per selection order
```

### JH-020
**Priority:** P2
**Status:** DONE
**Branch:** `agent/commerce-foundation` (PR #51, merged `23066c7`).
Originals #17–#23 closed without merging, history preserved.
**Objective:** Marketplace/commerce vertical foundation.
**Dependencies:** JH-001
**Completion report:**
```
TASK: JH-020
STATUS: DONE
CHANGED:
- packages/{payment-core,checkout-orchestrator,commerce-adapters,
  courier-fleet-core,delivery-compliance-gate,offer-engine,
  order-fulfillment-core}/** (new): 7 provider-agnostic, deterministic
  commerce contracts.
- offer-engine's package.json name corrected from
  @commerce/offer-engine to @jhadina/offer-engine (repo convention).
- Added standard scaffolding not present in the originals: scoped
  tsconfig.json + type-check script per package.
VERIFIED:
- These were NOT 7 independent PRs despite the queue's original
  framing. Real ancestry (true merge-base a6d85a3 for all six of
  #17-#22, matching pairwise git merge-base --is-ancestor checks):
  one linear chain, #20 -> #19 -> #22 -> #21 -> #18 -> #17 (confirmed
  by both ancestry and commit timestamps, 15:43 through 16:14 the
  same day). #17 is the full trunk, a strict superset of the other
  five — audited IT, not each sub-PR separately.
- All 7 commerce packages read directly: zero external API calls,
  zero credentials/secrets, zero database migrations, zero
  cross-package imports, zero wiring into apps/jhadina-web. No
  competing/duplicate commerce implementations among them — each
  covers a distinct concern (payment / checkout-reservation /
  POS-inventory / courier-fleet / delivery-compliance / offer-ranking
  / order-fulfillment) with no code overlap.
- #17's full diff also carries the identical "kitchen sink" bundle
  already found in PR #7/#16 (byte-diffed several files to confirm:
  growth/engine.ts, studio/character-dna.ts, opportunities/engine.ts
  all byte-identical) — same already-tracked JH-025-036 content, not
  re-deferred as duplicates.
- #23 (placementos-vertical-slice) is genealogically unrelated
  (different fork point) and every one of its 30 files diffed
  byte-identical against current main — fully superseded, nothing to
  reconstruct.
- type-check passed clean for all 7 packages on first run; CI green
  on PR #51; apps/jhadina-web, apps/pupsonstuff, and
  packages/jhadina-entertainment-core re-verified unaffected.
ARCHITECTURAL IMPACT:
- packages/jhadina-intelligence-contract (from #20, the chain's
  earliest link) is real but not commerce-specific — a general
  platform-to-Jhadina intelligence-event contract, not imported by
  any of the 7 commerce packages. Filed separately as JH-046 rather
  than bundled into the commerce foundation or dropped.
- No competing marketplace/payment architectures found requiring a
  human gate — the 7 packages are complementary, not overlapping.
COMMIT: 043f371 (PR #51), merged as 23066c7
NEXT: JH-021
```

### Deferred from PR #20 (filed per JH-020's resolution, not yet audited)

### JH-046
**Priority:** P2
**Status:** BLOCKED (human decision — architectural overlap confirmed)
**Branch:** `feat/jhadina-intelligence-contract` (PR #20, closed
without merging) — `packages/jhadina-intelligence-contract/**` (3
files: README, package.json, a single `src/index.ts` of pure type
definitions plus two pure helper functions — `isConfidenceValid`,
`canExecuteRecommendation`. No runtime, no orchestrator, no ports.
Nothing on `main` imports or references it.)
**Objective:** Jhadina Intelligence Contract (JIC) v1.0 — a general
interface between any application/platform and Jhadina's intelligence
layer: read-only events and scoped context packets in, evidence-backed
observations/forecasts/recommendations/command-proposals out, with
regulatory constraints overriding optimization and every recommendation
carrying evidence/rationale/confidence/risk/approval-requirements.
**Dependencies:** JH-001
**Audit (2026-08-13):** Read the full (small) source. Confirmed
safety-clean — pure types plus two pure predicates, nothing landable
or dangerous either way. The real finding is architectural overlap,
exactly as flagged: `packages/jhadina-core-spine` (already merged,
FOUNDATION lane) already implements the identical "observation →
context → decision → policy → action → audit" pipeline JIC describes,
as a working, pluggable, port-based orchestrator
(`JhadinaSpine.run()` in `spine.ts`), not just types:
- JIC's `ContextPacket` reuses that exact type name for a different
  shape (`contractVersion`/`mission`/`tenantId`/`jurisdiction` vs.
  core-spine's `purpose`/`relevantMemories`/`patterns`/`personality`).
- JIC's `Recommendation` ≈ core-spine's `DecisionProposal` (both:
  evidence-backed proposal with rationale/confidence/risk/approval).
- JIC's `CommandProposal`/`CommandResult` ≈ core-spine's
  `ActionRequest`/`ActionResult` — and separately, a *third* shape of
  the same concept already exists in `jhadina-action-core`
  (`ActionRequest`/`ActionAuditEvent`, the actual hardened execution
  boundary from JH-045).
- JIC's `EvidenceReference` ≈ core-spine's `EvidenceRef`.

So this isn't a security question — it's whether JIC closes a genuine
gap core-spine doesn't cover. The one real difference: JIC's event
vocabulary (`ORDER_CREATED`, `INVENTORY_RECEIVED`, `DELIVERY_STARTED`,
etc.) and multi-tenant/`jurisdictionId` fields suggest it was designed
for external, multi-tenant B2B platform integration (exposing
Jhadina's intelligence to third-party commerce/logistics systems)
rather than core-spine's internal personal-assistant reasoning loop —
that could be a real, distinct use case, or it could just be
unnecessary vocabulary sprawl for a use case nothing in this repo
currently needs. Nothing consumes JIC today either way.
**Human decision (2026-08-13):** Keep BLOCKED. Default direction is to
reject/supersede JIC in favor of `jhadina-core-spine` (which already
owns the working pipeline), unless a future audit demonstrates JIC
contains a genuinely missing capability (e.g. the external multi-tenant
platform-integration use case turns out to be real and needed). Not
renamed or rewritten speculatively — no code changes here, decision
recorded only.
**Next Step:** None until that audit/decision happens. Do not adopt,
merge, or rename anything speculatively in the meantime.

### JH-021
**Priority:** P2
**Status:** DONE
**Branch:** `agent/growth-core-foundation` (PR #52, merged `d6efd2e`).
Original `feat/jhadina-growth-channel-adapters-v9` (PR #41) closed
without merging, history preserved.
**Objective:** Complete the advertising intelligence loop.
**Dependencies:** JH-001 (done), JH-015 (done)
**Completion report:**
```
TASK: JH-021
STATUS: DONE
CHANGED:
- packages/growth-core/** (56 files): full attribution, creative,
  customer, economics, channels (adapters/campaign-orchestrator/
  registry/delivery-reconciliation), events, intelligence
  (experiment-planner/growth-decision-feed/growth-loop/
  opportunity-engine), learning, lineage, opportunity, and store
  modules, each with a Vitest test file.
- Added standard scaffolding not present in the original: scoped
  tsconfig.json, type-check/test scripts, vitest devDependency.
VERIFIED:
- True merge-base a6d85a3, same fork point as PR #6/#7/#8/#16/#17-22
  (same "kitchen sink" branch family this whole cleanup pass has been
  disentangling).
- Diffed growth-core's 30 pre-existing files against PR #7's copies
  (already deferred as JH-025) — byte-identical. The 26 new files
  complete rather than duplicate that work.
- Read every new advertising-execution file directly (channels/,
  events/advertising-events.ts, intelligence/growth-loop.ts): only
  concrete channel adapter anywhere is MockChannelAdapter (in-memory
  fake); CampaignExecutionOrchestrator.execute() and
  assertExecutionApproved() both hard-require an explicit policy
  approval decision before any action; reconciliation/normalization
  functions are pure, no fetch calls; runGrowthIntelligenceLoop() is
  a pure planning function. Full grep sweep for fetch/credentials/
  secrets/bearer/http(s):// across every new file: nothing found.
- Still fully unwired — nothing in apps/jhadina-web imports
  growth-core, same dormant shape as JH-019/020's landed packages.
- type-check clean; test: 26 files / 61 tests passing; CI green on
  PR #52; jhadina-web, pupsonstuff, entertainment-core, payment-core
  re-verified unaffected.
ARCHITECTURAL IMPACT:
- No human/security gate needed: read-only observation/attribution/
  planning infrastructure throughout, no live advertising execution,
  no credentials, no autonomous publishing path — matches the
  category explicitly called safe rather than the category requiring
  a stop.
- Folded JH-025 into this task's landing (see JH-025, now
  SUPERSEDED) rather than tracking it as a separate stale entry once
  its full/completed form was found and landed here.
- Rest of PR #41's diff (Studio pipeline, Publishing, Money/Plaid,
  homepage deletion) is the same already-tracked content from
  JH-025-036 (byte-diffed to confirm) — not re-deferred as
  duplicates.
COMMIT: cd15059 (PR #52), merged as d6efd2e
NEXT: next unblocked task per selection order
```

---

## EXPERIMENT

### JH-022
**Priority:** P3
**Status:** BLOCKED
**Branch:** `feat/jhadina-energy-opportunity-core` (PR #32)
**Objective:** Deterministic profitability/authorization *policy* logic
for an energy/compute opportunity core.
**Dependencies:** JH-001
**Human gate:** Full audit completed (2026-08-13) — see consolidated
finding below. Not a security stop (every file read is genuinely
read-only/pure/policy-gated); this is an architectural-fork stop shared
with JH-023/024.

### JH-023
**Priority:** P3
**Status:** BLOCKED
**Branch:** `ci/reorg-safe-bitcoin-checkpoint` (PR #39)
**Objective:** Reorg-safe, restart-safe checkpoint scanner for automatic
Bitcoin payout *discovery* (read-only — no wallet access, no signing).
**Dependencies:** JH-022 — this queue originally assumed JH-022→023→024
stack in git. They do not: exhaustive pairwise `git merge-base
--is-ancestor` checks show all three PRs are independent siblings, not a
chain.
**Human gate:** See consolidated finding below.

### JH-024
**Priority:** P3
**Status:** BLOCKED
**Branch:** `ci/profitability-snapshot` (PR #38)
**Objective:** Realized-profitability snapshot adapter with idempotent
snapshot persistence.
**Dependencies:** JH-023 (see JH-023 note — not actually stacked)
**Human gate:** See consolidated finding below.

**Consolidated finding (2026-08-13) — architectural fork, not a security
stop:**

Every file across all three branches was read in full. Confirmed safe
throughout: `cpuminer.ts` only assembles a sanitized dry-run command
object (never spawns a process, opens a socket, or reads pool
credentials — `sanitizePoolUrl()` strips user/pass before use);
`bitaxe.ts` performs exactly one read-only GET to a LAN AxeOS device's
`/api/system/info` (no control endpoints); `bitcoin-core.ts` /
`bitcoin-payout-discovery.ts` / `mining-payout-ingestion.ts` verify
payouts against an injected read-only Bitcoin Core client (never signs
or sends); `economic-decision.ts` / `decision-ledger.ts` /
`realized-profitability.ts` / `profitability-snapshot.ts` /
`command-center.ts` are pure or in-memory, advisory-only, and
explicitly documented as never starting/stopping hardware or moving
funds; `supabase-decision-ledger.ts`, `supabase-decision-reader.ts`,
`supabase-mining-payout-checkpoint.ts`, and
`supabase-mining-payout-processor.ts` all take credentials via
constructor-injected config (never read `process.env.*` directly) and
call only REST/RPC endpoints, never signing or transferring anything.
Both SQL migrations (`20260812192807_create_jhadina_mining_scan_checkpoints.sql`,
`20260812200000_create_mining_payout_processing.sql`) enable RLS and
revoke all table/function privileges from `public`/`anon`/`authenticated`
— only a trusted service role can reach them. No file anywhere in the
trio mines, signs, or moves funds; this matches the EXPERIMENT lane's
sanctioned "read-only observation layer" boundary.

The actual blocker is architectural, not security:

- **PR #32 and PR #38 are the same branch.** They share 79 identical
  commits (5502426..3139962, byte-identical for all 16 shared files —
  `bitaxe.ts`, `bitcoin-core.ts`, `coin-*.ts`, `command-center.ts`,
  `cpuminer.ts`, `decision-ledger.ts`, `economic-decision.ts`,
  `financial-events.ts`, `moneycore-bridge.ts`, `profitability-*.ts`,
  `realized-profitability.ts`, `supabase-decision-*.ts`) and then
  diverge at that same commit into two *mutually exclusive* designs for
  the same responsibility — turning Bitcoin Core chain data into
  verified, recorded mining payouts:
  - PR #32 continues with `bitcoin-payout-discovery.ts`: a block-range
    scanner keyed by wallet address (`fromHeight`/`toHeight`, iterates
    blocks, filters `vout` by address).
  - PR #38 continues with `mining-payout-ingestion.ts` +
    `mining-profitability-pipeline.ts`: direct per-payout verification
    by txid against `bitcoin-core.ts`'s `verifyMiningPayout()`, with no
    block scanning at all.
  Both are legitimate, safety-clean designs. They are not composable —
  a real product has one canonical way to discover/verify payouts, not
  two.
- **PR #39 extends PR #32's design, not PR #38's**, adding
  `mining-scan-runner.ts` (non-overlapping scan scheduler),
  `supabase-mining-payout-checkpoint.ts` +
  `supabase-mining-payout-processor.ts` (durable checkpoint + atomic
  payout-processing RPC adapters), `mining-payout-processing.ts`
  (transactional processor), `REORG_CHECKPOINT_CI.md`, and both SQL
  migrations. But PR #39's own tree does **not** include
  `bitcoin-payout-discovery.ts` — it depends on that file existing
  without carrying it, so PR #39 alone does not compile/type-check as a
  standalone diff.
- **Main already has a broken fragment of PR #32/#39's design,
  committed directly outside PR review.** `git log origin/main --
  packages/energy-opportunity-core/` shows exactly two commits already
  on `main` — `566efac` ("feat: add reorg-safe bitcoin payout checkpoint
  scanner") and `53660bb` ("test: cover checkpoint restart and reorg
  handling") — which are byte-identical to the first two commits of PR
  #39's own branch. `packages/energy-opportunity-core/` on `main`
  currently contains **only** `bitcoin-payout-checkpoint.ts` and its
  test — no `package.json`, no `tsconfig.json`, and
  `bitcoin-payout-checkpoint.ts` imports from
  `./bitcoin-payout-discovery.ts`, which does not exist anywhere on
  `main`. This package is not wired into any workspace build (no
  `package.json` means pnpm's `packages/*` glob does not pick it up),
  so nothing has ever type-checked this dangling import — it is latent,
  pre-existing breakage, unrelated to anything built this session.

**Decision needed:** (1) which design is canonical for Bitcoin payout
verification — PR #38's direct per-txid verification, or PR
#32+#39's resumable/reorg-safe block scanner (and if the scanner design
wins, PR #39's checkpoint/processing layer composes cleanly on top of
PR #32, once PR #32's `bitcoin-payout-discovery.ts` is included); (2)
what to do about the two commits already on `main` — complete them
(pull in PR #32's `bitcoin-payout-discovery.ts` + add the missing
`package.json`/`tsconfig.json` scaffolding) or treat them as dead code
to be removed, since they were never part of a reviewed, CI-verified
package. Not decided here — this is exactly the "second implementation"
pattern `docs/DO_NOT_BUILD.md` names, except neither side is clearly
the sanctioned one, so it needs a human call rather than an implicit
pick.

### Explicitly rejected (not tasks)

Actual Bitcoin/Dogecoin miner execution software, a mining-pool server
(`miningcore`), and a wallet private-key extraction tool (`pywallet`)
were proposed in chat and declined. See `docs/DO_NOT_BUILD.md`. This
lane tracks the read-only, policy-gated observation layer only
(JH-022/023/024) — nothing here mines, signs, or moves funds.

### JH-047
**Priority:** P3
**Status:** SUPERSEDED
**Branch:** `copilot/phase-1-1a-day-2-integration` (PR #2, closed
without merging 2026-08-13, history preserved)
**Objective:** Typed JANET client (`lib/janet/{client,types,errors}.ts`)
against an external JANET service (`localhost:3001`,
`GET /memory/pending` / `POST /memory/:id/approve`), plus a `/memory`
pending-review UI.
**Audit (2026-08-13):** True merge-base `408a2f8`, five days and a
large amount of landed work behind current `main`. The client file
this PR builds out already exists at the same path on `main` — but
unused there (nothing imports `lib/janet/client.ts` outside its own
barrel). `main`'s actual JANET implementation is architecturally
different: an in-process pipeline (`JanetService` →
`MemoryRepository` → `InMemoryStorage`) backing `/api/memory/approve`
and `/api/memory/reject`, not an external HTTP service; there's no
`/memory` UI page on `main` for this PR's queue UI to attach to. The
diff also touches `apps/jhadina-web/pages/index.tsx` (106 lines),
colliding with the homepage work JH-014 preserved as canonical.
**Next Step:** None — closed as superseded. If the external-JANET-
service contract this PR targets is still wanted, that's a fresh task
scoped against `main`'s current JANET architecture, not a revival of
this diff.

---

## JHADINA OS INTEGRATION PHASE 1 — SPINE PROOF

Once the JH-### backlog reached a checkpoint (2026-08-13, main @
`df36611`) where every remaining open item was an explicit human gate
rather than unaudited work, the architecture audit found the core
infrastructure was ahead of its own integration: most FOUNDATION
packages were real, tested, and CI-verified, but not composed into a
single working path a real action could travel end to end. This lane
tracks that integration work directly — proving the already-landed
cores actually compose — rather than filing it under the JH-###
archaeology numbering, since it isn't sourced from any old branch/PR.

Uses `SP-` IDs to keep this cleanly separate from the JH-### backlog.

**Standing rule for this whole lane:** proving composability with safe
reference implementations is not license to resolve any of the 15
frozen human gates below. None of them are touched, reopened, or
implicitly decided by this work:

JH-007 (DirectorOS vs Mission Control), JH-022/023/024 (mining
architecture/payout verification), JH-026 (Studio infrastructure),
JH-028/033/034 (canonical Money/Plaid path), JH-032's redraft/version
remainder, JH-038's checkout/Stripe decision, JH-039's Printify +
Supabase-schema remainder, JH-041 (Justice reconciliation), JH-043
(GitHub/JANET security boundary), JH-046 (duplicate Intelligence
Contract).

### SP-1 — Governed action (Growth draft approval)
**Status:** DONE
**Branch:** `spine-proof-growth-approval` (PR #62, merged `14c17df`)
**Objective:** Prove one real, UI-originated action can travel the
complete governed lifecycle — identity → policy → explicit approval →
ActionExecutor → audit — using only already-landed FOUNDATION
infrastructure, no new package, no external side effect.
**Completion report:**
```
TASK: SP-1
STATUS: DONE
CHANGED:
- packages/security-core/src/index.ts: added 'growth.draft.approve' to
  JHADINA_BASE_SECURITY_POLICY's allowed + approval-gated capabilities.
- apps/jhadina-web/src/lib/growth/governed-approval.ts (new): composes
  identity (JH-044's SupabaseActionIdentityVerifier) -> policy
  (security-core's SecurityCoreActionPolicy) -> explicit approval
  (action-core's request/approve/consume receipt flow) ->
  ActionExecutor (JH-045-hardened) -> audit (ActionLedger) as five
  explicit, separately-auditable stages, reusing the existing
  approveGrowthDraft() handler unchanged.
- apps/jhadina-web/src/lib/growth/governed-approval-runtime.ts (new):
  process-local composition root — in-memory ledger + approval store
  (reference adapters; SupabaseAuditLedger, already implemented, is a
  one-line swap whenever this needs to survive process restarts).
- apps/jhadina-web/src/app/api/growth/drafts/approve/route.ts: now
  calls the governed path instead of approveGrowthDraft() directly.
  The existing /growth "Approve" button is unchanged — the same click
  now runs through the full spine.
- apps/jhadina-web/src/lib/growth/governed-approval.test.ts (new): 6
  tests — full happy path with ledger inspection, identity-mismatch
  fail-closed, policy-denial fail-closed, handler-level ownership
  enforcement surviving identity+policy+approval, double-approval
  rejection.
- Found and fixed two real infrastructure gaps, surfaced by this being
  jhadina-web's first cross-package import of @jhadina/action-core:
  jhadina-web's own tsconfig.json redefines (not extends) the root's
  "paths", losing the explicit jhadina-action-core mapping (the
  generic @jhadina/* wildcard only matches directories named after
  their unscoped package name); and Vitest doesn't read tsconfig paths
  at all, needing its own vitest.config.ts. Also gave
  packages/security-core its first package.json/tsconfig.json — it had
  neither, and its 3 real test files had never run in CI (same class
  of gap JH-045 found and fixed for jhadina-action-core).
VERIFIED:
- pnpm type-check: 20/20 packages clean.
- pnpm test: 12/12 tasks; jhadina-web 70/70 (64 existing + 6 new);
  security-core 3/3 (previously 0 ever run).
- pnpm build: real Next.js production build succeeds,
  /api/growth/drafts/approve present in the route manifest.
- pnpm lint: clean.
COMMIT: a416272 (PR #62), merged as 14c17df
NEXT: SP-2 (Commerce)
```

### SP-2 — Commerce (checkout → payment → fulfillment)
**Status:** DONE (PR #63, merged as `e3f5cbd`)
**Branch:** `spine-proof-commerce` (PR #63)
**Objective:** Prove the commerce family the architecture audit flagged
as "seven contracts, zero implementations" actually composes — the
smallest real path (three of the seven contracts): commerce intent →
`checkout-orchestrator` → `payment-core` (in-memory adapter) →
`order-fulfillment-core` → audit/event. No new commerce package, no
live provider, no credential, no Supabase dependency.
**Completion report:**
```
TASK: SP-2
STATUS: DONE
CHANGED:
- apps/jhadina-web/src/lib/commerce/reference-adapters.ts (new):
  in-memory implementations of every adapter interface all three
  orchestrators need — deterministic, inspectable, configurable to
  fail (inventory/payment/policy) so fail-closed paths are actually
  exercised.
- apps/jhadina-web/src/lib/commerce/bridge-adapters.ts (new): the real
  composition proof. checkout-orchestrator/payment-core/
  order-fulfillment-core were built independently (none depends on
  either other). Two genuine mismatches surfaced and were resolved at
  the adapter boundary, not by changing any package: (1)
  checkout-orchestrator's PaymentGateway carries only a single netted
  amountMinor, while payment-core's PaymentIntentRequest wants a
  lines/taxes/platformFees breakdown — bridged as one opaque line
  item; (2) checkout-orchestrator's refund reason is a free-form
  string against payment-core's fixed reason taxonomy — bridged with
  an explicit mapping; (3) order-fulfillment-core's Order requires a
  single merchant/location/jurisdiction that a checkout isn't
  guaranteed to have uniformly — the bridge asserts single-merchant/
  single-location and fails closed otherwise (a real scope boundary,
  not silently papered over).
- apps/jhadina-web/src/lib/commerce/commerce-intent.ts (new):
  top-level composition, returns full resulting state for inspection.
- apps/jhadina-web/src/lib/commerce/commerce-intent.test.ts (new): 6
  tests inspecting actual state/events — happy path (real computed
  total captured, order + manifest + custody event all recorded),
  inventory failure, payment decline, fulfillment policy denial AFTER
  successful payment (proves checkout-orchestrator's own automatic-
  refund path fires correctly across the bridge), multi-merchant
  checkout, empty checkout — all fail closed.
- apps/jhadina-web/vitest.config.ts: added aliases for the three
  newly-consumed packages (same class of gap SP-1 found).
VERIFIED:
- pnpm type-check: 20/20 packages clean.
- pnpm test: jhadina-web 76/76 (70 existing + 6 new).
- pnpm build: real Next.js production build succeeds.
- pnpm lint: clean.
ARCHITECTURAL IMPACT:
- No contract required fixing — both real mismatches found were
  resolved at the adapter boundary.
COMMIT: PR #63, merged as e3f5cbd
NEXT: SP-3 (Money/Plaid).
```

### SP-3 — Money (Plaid consolidation)
**Status:** DONE (PR #64, merged as `cbd291c`)
**Objective:** Unify JH-028/033/034 around the existing governed path
(`money-core` → `PlaidReadOnlyAdapter` → capability check → credential
resolver), so the question stops being "which PR do we merge" and
becomes "what is the canonical Money API the UI consumes." Same
acceptance boundary as SP-1/SP-2: reference adapters, no live provider,
fail-closed tests, no change to the frozen JH-028/033/034 human-gate
status itself — this proves the *path*, it doesn't unilaterally pick a
product surface.
**Completion report:**
```
TASK: SP-3
STATUS: DONE
DISCOVERY: money-core already has its own complete, unwired production
composition for account-read — parallel to the one hand-built for
Growth in SP-1: account-read-handler.ts (assertCapability + handler) ->
governed-account-read.ts (MONEY_CORE_SECURITY_POLICY, base policy +
money.account.read) -> production-account-read.ts
(SecurityCoreActionPolicy + createProductionActionExecutor, the same
action-core spine SP-1 proved) -> governed-provider-account-read.ts
(adds MoneyProviderHealthGate + MoneyProviderRegistry in front). This
proof composes those real pieces with reference dependencies rather
than reinventing them, exactly as instructed ("keep the existing
governed Plaid adapter as the eventual production boundary").
CHANGED:
- packages/money-core/src/index.ts (new): money-core's package.json has
  declared main/types as "./src/index.ts" since the package was
  created; the file never existed, so nothing outside the package could
  import it by its bare specifier — a real infra gap, same class as
  SP-1's missing security-core package.json. Added as a minimal barrel
  of the public composition-root surface (capabilities, bank-adapter,
  credential-resolver, provider-health, provider-registry,
  provider-adapter-factory, account-read-handler,
  governed-account-read, production-account-read,
  governed-provider-account-read, read-only-http-bank-adapter,
  plaid-read-only-adapter, plaid-provider-builder). Deliberately
  excludes postgres-client/postgres-idempotency-store and the
  transaction-write/privacy-defense modules — out of scope for this
  proof and some pull in the 'pg' package unnecessarily.
- apps/jhadina-web/src/lib/money/reference-adapters.ts (new): reuses
  the real, already-landed ReadOnlyHttpBankAdapter (provider-neutral,
  HTTPS-enforced, no payment/transfer methods) with an injected fake
  fetchImpl that never performs network I/O — not a second Plaid
  client, not a hand-rolled adapter double. Records every request
  (including the Authorization header) so tests can prove the
  credential reached the provider boundary without ever leaking past
  it. Also: a workspace-entitlement reference checker, and an in-memory
  stand-in for the Supabase RPC client SupabaseAuditLedger writes
  through (no Supabase dependency for this proof; swapping in the real
  client is a one-line change).
- apps/jhadina-web/src/lib/money/governed-account-read.ts (new):
  composition root. Wires ProviderAdapterFactory +
  EnvironmentCredentialResolver (injected in-memory env map, never
  process.env) to build the reference adapter, registers it in a
  MoneyProviderRegistry, and hands that straight to money-core's own
  createGovernedProviderAccountReadExecutor — no reimplementation of
  the governance chain.
- apps/jhadina-web/src/lib/money/governed-account-read.test.ts (new): 9
  tests covering all 7 required cases (2 identity variants — wrong
  user, unverifiable/no session): authorized read succeeds (real
  mapped account data, ledger started->completed, exactly one provider
  call carrying "Bearer <credential>"); wrong identity and missing
  identity both fail before any ledger event or provider call exists
  (see ARCHITECTURAL FINDING below); missing money.account.read from
  the provider's own capability allow-list fails at the health gate
  before the provider is reached, cross-checked against the
  independent MoneyCapabilityPolicy; unauthorized workspace access
  fails after policy allows but before the provider is reached
  (started->failed); a live provider HTTP failure fails cleanly and is
  recorded as failed, with the request actually having reached the
  provider; a bonus case shows an unresolvable credential fails closed
  before any adapter is even constructed; no credential string appears
  anywhere in the returned accounts or the audit trail, and the
  returned account shape has no field that could carry one; no
  mutation capability exists structurally (the adapter has no
  createPayment/createTransfer) or at the policy layer
  (MONEY_CORE_SECURITY_POLICY never allow-lists a financial-mutation
  capability), and dispatching a mutation-shaped action through the
  same executor is rejected.
- apps/jhadina-web/vitest.config.ts: added the @jhadina/money-core
  alias (same class of gap SP-1/SP-2 found — Vitest doesn't read
  tsconfig paths).
VERIFIED:
- pnpm --filter @jhadina/money-core type-check: clean.
- pnpm --filter @jhadina/money-core test: 11/11 (unchanged, all
  pre-existing).
- pnpm -r type-check: 22/23 packages clean (apps/pupsonstuff fails on a
  pre-existing, unrelated missing vitest type declaration — confirmed
  present on main before this branch, untouched by this proof).
- pnpm vitest run (jhadina-web): 85/85 (76 existing + 9 new).
- pnpm --filter jhadina-web build: real Next.js production build
  succeeds.
- pnpm --filter jhadina-web lint: clean (3 pre-existing, unrelated
  warnings).
ARCHITECTURAL FINDINGS (inspecting the actual boundary, not asserted
behavior):
- VerifiedActionExecutor checks identity BEFORE the ledger's "started"
  event is appended. An identity failure (wrong user or verifier
  rejection) therefore produces zero audit events — there is nothing to
  durably audit against an identity that was never verified. This is a
  real, deliberate property of the already-landed production
  composition (not something this proof added or changed) and is
  worth knowing before anyone builds an "audit every attempt" surface
  on top of it.
- createGovernedProviderAccountReadExecutor runs the provider
  health/capability-allow-list check BEFORE identity verification (it
  wraps VerifiedActionExecutor.execute, not the other way around). A
  caller whose identity would fail can still learn whether a given
  provider/capability is configured. Minor; not fixed here since fixing
  it means reordering money-core's own composition, out of scope for a
  reference proof — flagged for the next checkpoint.
- money-core ships two independent ActionPolicy implementations for
  money actions: MoneyCapabilityPolicy (capability-policy.ts) and
  SecurityCoreActionPolicy over MONEY_CORE_SECURITY_POLICY
  (governed-account-read.ts). Only the second is wired into the
  production composition; MoneyCapabilityPolicy has no consumer
  anywhere in the package. Same failure mode the architecture audit
  named for growth-core/entertainment-core: real, tested,
  unwired/duplicate. Not resolved here — noted for the checkpoint.
COMMIT: PR #64, merged as cbd291c
NEXT: second architecture checkpoint (per instruction), not Proof #4.
```

---

## ARCHITECTURE CHECKPOINT #2 — do the three proofs share one boundary?

**Date:** 2026-08-13 · main @ `de2e0ea` (corrections merged) · after SP-1/SP-2/SP-3

Performed per explicit instruction after SP-3, in place of starting a
Proof #4. Full published report:
https://claude.ai/public/artifacts (see "Jhadina OS Checkpoint Two" —
title/URL as published this session). Summary below is the durable
record; the artifact has the full comparison and prose.

### At a glance

| Dimension | SP-1 Growth | SP-2 Commerce | SP-3 Money |
|---|---|---|---|
| Identity check | hand-rolled, own ledger entry on failure | **none, anywhere** | real `VerifiedActionExecutor`, silent on failure |
| Policy/capability | `SecurityCoreActionPolicy` (base policy) | fulfillment `PolicyGate` — jurisdiction/regulatory, not actor-capability | `SecurityCoreActionPolicy` (money policy) |
| Approval | request→approve→consume-once receipt | none | none (read capability isn't approval-gated) |
| Audit trail | `ActionLedger` (hand-driven) | domain-native: `CustodyLedger` + checkout status history | `ActionLedger` via `SupabaseAuditLedger`'s real RPC shape |
| Fail-closed on | identity mismatch, policy denial, handler ownership, double-approval | inventory, payment decline, fulfillment denial, multi-merchant, empty cart | identity, health/capability, workspace, provider error, credential |

### Five findings (established invariant / observed / duplicate / gap / minimal change / stays domain-specific)

**A — Identity-failure visibility diverges (Growth logs it, Money's real executor doesn't).**
Invariant: identity verified before policy/ledger/handler, always true in both.
Observed: SP-1 hand-appends a `denied` ledger entry (with the claimed,
unverified userId) on identity failure; SP-3's real
`VerifiedActionExecutor` appends nothing — there's no verified actor to
attribute an event to. Duplicate: SP-1's hand-rolled identity+policy
pre-stage is load-bearing, not laziness — an approval-required flow
needs the policy decision known before a receipt can be requested, and
`VerifiedActionExecutor` only exposes that decision bundled inside a
single `execute()` call. Gap: `action-core` has no first-class
"evaluate policy without executing" primitive. Minimal change: none to
either merged proof — not auditing failed identity checks in the
shared ledger is the *correct* default (can't durably attribute an
event to an unverified actor); SP-1's own denied-entry-with-unverified-
userId is a mild antipattern worth reconsidering next time Growth is
touched, not urgent. Domain-specific: how a domain surfaces rejected
identity claims (rate-limiting, alerting) is product-specific.

**B — Money's health gate ran before identity — FIXED.**
Invariant: no system info revealed before identity is verified.
Observed: only Money has a health-gate concept
(`MoneyProviderHealthGate`); it ran before the identity-checking
executor. Gap: real, confirmed by SP-3's own tests. Minimal change:
**made** — `governed-provider-account-read.ts` now verifies identity
before the health gate runs (PR #65, `de2e0ea`). Domain-specific: the
health-gate concept itself stays Money-only until a second domain needs
it.

**C — `MoneyCapabilityPolicy` was dead, unwired, and semantically wrong — REMOVED.**
Invariant: exactly one `ActionPolicy` reachable from a domain's
production composition. Observed: money-core shipped two —
`SecurityCoreActionPolicy(MONEY_CORE_SECURITY_POLICY)` (real, wired,
correct) and `MoneyCapabilityPolicy` (zero consumers, and its
`evaluate()` collapsed `approval_required` into `deny`, silently
disagreeing with the canonical policy). Minimal change: **made** —
deleted entirely (PR #65, `de2e0ea`). Money now has exactly one
`ActionPolicy`.

**D — Commerce has no identity/capability layer at all. The largest finding.**
Invariant (drawn from Growth/Money): any action mutating state or
reading sensitive data on a real actor's behalf must pass through
identity verification and a capability/policy decision first. Observed:
`CheckoutOrchestrator.execute(checkoutId)` takes no actor parameter;
`customerId` is a plain unverified string; grep across
checkout-orchestrator/payment-core/order-fulfillment-core found the
only identity-adjacent field anywhere is an optional, non-authorizing
`actorId` on custody events (attribution logging only). Duplicate:
none — Commerce doesn't reimplement identity/policy, it simply doesn't
have it. Gap: **real, the most significant finding of this checkpoint.**
SP-2 proved the three commerce contracts compose into a working
lifecycle; it did not prove that lifecycle is governed by any actor-
authorization boundary. As shipped, any caller who can construct a
`CommerceIntent` can run a full checkout for any `customerId` with no
session, no capability check, no audit trail beyond `CustodyLedger`.
Minimal change: **not made** — closing this is new integration work
(wrapping the existing, unchanged checkout lifecycle behind the same
identity→policy→execute→audit shape Growth/Money already use), not a
correction to something already built. Domain-specific: fulfillment's
`PolicyGate` (jurisdiction/regulatory: accept/pick/handoff/deliver/
cancel) and inventory/pricing failure handling are correctly domain
logic and should not fold into a shared `ActionPolicy` — they answer
"can this order be fulfilled here," not "is this actor allowed to
act." Both can coexist once an actor-capability check gates entry.

**E — Commerce's audit trail is real, just not `ActionLedger`-shaped.**
Not a defect — Growth/Money emit `ActionAuditEvent`s; Commerce emits
`CustodyLedger` events + merchant-adapter call log + checkout status
history, three domain-native shapes carrying real information an
`ActionAuditEvent` can't hold (custody to/from states, computed
totals). Consequence: a future single-ledger "Activity" surface
(Checkpoint #1's proposal) would only ever show Growth/Money until
Finding D is closed. Minimal change: none now — when D is closed, add
one coarse-grained governance-layer event at the outer boundary; the
rich domain-native trail stays as-is underneath. Not a call to unify
audit formats.

### Six questions, answered

1. **Genuinely common:** fail-closed behavior everywhere, dependency-
   injected adapters at every external boundary, and — in Growth and
   Money — the identical real classes (`VerifiedActionExecutor`,
   `SecurityCoreActionPolicy`, `ActionLedger`).
2. **Actually different:** audit shape (unified vs. Commerce's
   domain-native trail) and what "policy" means (actor-capability vs.
   Commerce's jurisdiction/regulatory `PolicyGate`) — both real,
   correct, not to be forced together.
3. **Duplicates removed:** `MoneyCapabilityPolicy`, done. Nothing
   else qualifies — SP-1's pre-stage is load-bearing, Commerce's
   `PolicyGate` answers a different question, not a duplicate of
   anything.
4. **Canonical ordering:** identity → policy/capability → ledger →
   handler/external provider, always. Both real violations found
   (A, B) are now resolved or explicitly justified.
5. **Same boundary or parallel versions?** Split, honest answer:
   Growth and Money are **the same boundary** — two independent
   integrations converged on identical primitives without being told
   to, which is stronger evidence than either proof alone. Commerce is
   **categorically outside it** — not a parallel version, an absence.
6. **Reusable OS primitive needed before another domain:** none —
   `VerifiedActionExecutor` + `SecurityCoreActionPolicy` + `ActionLedger`
   already is that primitive, proven twice independently. The next
   domain needs the existing primitive applied, not a new one.

### Verdict

**The shared primitive is sufficient. The gap is that one domain
(Commerce) isn't using it yet.** Two corrections made (B, C) — the
smallest scope the evidence supported. Finding D is real but is not a
maturity gap in the primitive; it's the next unit of work whenever
taken up: wrap Commerce's existing, unchanged checkout lifecycle in an
identity → `commerce.checkout.execute` capability → execute → audit
shell mirroring Growth/Money, leaving `PolicyGate`/`CustodyLedger`/all
SP-2 reference adapters untouched underneath.

**NEXT: no Proof #4 started. Finding D is named as the logical next
step, not begun. All 15 frozen human gates remain frozen — untouched
by this checkpoint or its corrections.**

---

## JHADINA OS INTEGRATION PHASE 2 — REAL PRODUCT LOOP

Explicitly not another domain proof. Phase 1 proved the backend spine
composes (SP-1/2/3) and Checkpoint #2 confirmed it's mature enough to
build on (Growth and Money converged on it independently). Phase 2's
question is different: can a real user interaction in Jhadina's
*shipped* UI travel through that composition and come back as
observable state — not another mock adapter, the actual app.

### PL-1 — Command Center → governed Growth action

**Status:** DONE
**Objective:** `PersonalCommandFeed` → user selects a proposed Growth
action → identity context → capability/policy evaluation → Approval
Center → `ActionExecutor` → audit ledger → Activity Timeline →
Command Center reflects result. Reuses `PersonalCommandFeed`, the
JH-031 shell, the existing `/growth` Approval Center, and SP-1's
governed spine exactly as they are. No new governance package, no
live advertising API, no credentials, no new parallel policy/identity
implementation.

**Pre-build audit (required before any code, per instruction):**
- `PersonalCommandFeed` (`pages/index.tsx` + `components/home/
  PersonalCommandFeed.tsx`) was 100% static demo data — no fetch, no
  click handlers wired to anything.
- `/growth` was already the real Approval Center: it already fetched
  real drafts and its Approve button already called SP-1's governed
  path. Further along than expected.
- **A real, pre-existing bug found, not hypothetical:** `/growth`'s
  client code sent a hardcoded `x-jhadina-user-id: "user_demo"` header
  as the claimed identity (same stub pattern in `/opportunity`). SP-1's
  real `SupabaseActionIdentityVerifier` checks that claim against the
  actual, server-verified Supabase session subject and throws `"Action
  identity mismatch"` on any mismatch. No real Supabase user has the
  literal id `"user_demo"` — so, as shipped, the existing Approve
  button could not have completed successfully against any real
  logged-in session. Confirmed by reading both files, not inferred.
- No Activity Timeline UI existed anywhere — JH-031's nav was
  explicitly trimmed to drop a stubbed `/activity` entry because
  nothing backed it (confirmed in that entry's own completion report).
- **The one genuine architectural fork:** SP-1's audit ledger
  (`governed-approval-runtime.ts`) is a process-local, in-memory
  singleton; no Supabase migration/RPC for the real `SupabaseAuditLedger`
  exists anywhere in `supabase/migrations`. Flagged to the user rather
  than guessed. **Decision: in-memory ledger for this milestone.**
  Explicit rule given: use the existing `ActionLedger` interface and
  the in-memory implementation; no Supabase migration, `audit_events`
  table, RPC, or new persistence abstraction in this slice; the
  implementation must be written so swapping in the already-existing
  `SupabaseAuditLedger` later requires only dependency wiring, not
  changes to the UI, governance flow, or `ActionExecutor`. Durability is
  explicitly the next milestone, not this one.
- Global middleware (`src/middleware.ts` → `updateSession`) already
  requires a real Supabase session for every route except `/login`/
  `/auth` — confirmed real, not assumed. This is why the identity-header
  bug matters (a real session always exists by the time these pages
  render) and why it's a bug fix, not a design decision.

**Completion report:**
```
TASK: PL-1
STATUS: DONE
CHANGED:
- src/lib/auth/current-user.ts (new): getCurrentUserId() reads the
  real, client-side Supabase session (auth.getUser()) — replaces the
  hardcoded "user_demo" header. Not a new identity system: it only
  reads the identity Supabase already established and hands it to
  SP-1's existing server-verified boundary.
- src/app/growth/page.tsx: fetch calls now send the real signed-in
  user id instead of "user_demo" — the bug fix above. No other change;
  the existing Approve/Reject/Redraft/Schedule flow and its calls into
  SP-1's governed path are otherwise untouched.
- src/lib/growth/governed-approval-runtime.ts: runGovernedGrowthDraftApproval
  now accepts an optional identityVerifierOverride (default: the real
  createRequestIdentityVerifier(), unchanged production behavior).
  Exists solely so tests can exercise the actual composition root the
  API routes call — createRequestIdentityVerifier() makes a real
  Supabase call with no meaning in a test process, so this was
  previously untestable at this layer; SP-1's own tests only covered
  the function one level below (approveGrowthDraftGoverned). Also adds
  listGovernedGrowthActivity(claimedUserId, override?): the Activity
  Timeline's read boundary — identity-gated the same way approval is,
  filters the shared ledger singleton to events belonging to the
  verified caller only.
- src/app/api/growth/activity/route.ts (new): thin GET handler —
  reads the same x-jhadina-user-id header pattern as the other Growth
  routes, calls listGovernedGrowthActivity with the real identity
  verifier (no override), returns the caller's own events as JSON.
  This is the only path from the ledger to any UI — no UI component
  imports the ledger, action-core, or governed-approval-runtime
  directly (grep-verified).
- src/app/activity/page.tsx (new): Activity Timeline UI. Fetches
  /api/growth/activity with the real signed-in user id, renders each
  event's type/status/timestamp/metadata. Empty/loading/error states
  handled explicitly; never assumes success.
- components/home/PersonalCommandFeed.tsx: added one real card. Every
  other card is still JH-014's original demo content (no backend
  exists yet for those kinds) — untouched. The new card fetches the
  signed-in user's actual pending Growth drafts through the same
  /api/growth/drafts route /growth already uses, shows one when
  something real is pending, and its "Review" action links to /growth
  (the existing Approval Center) rather than reimplementing approve/
  deny controls inline — matches the diagram's own separation between
  "user selects a proposed action" (Command Center) and "Approval
  Center" (a distinct step). Fails silently on this preview surface if
  signed out or the fetch fails; errors that matter surface on /growth
  itself.
- src/components/JhadinaShellNavigation.tsx: added Activity to the
  Worlds dropdown (not the fixed five-button primary nav, which JH-031
  deliberately caps at five). Now genuinely reachable, not an orphan
  page.
- src/lib/growth/governed-approval-runtime.test.ts (new): the ten
  required lifecycle points, all against the real composition-root
  functions the API routes call (not the one-layer-down functions
  SP-1 already tested) — proposal visible via listGrowthDrafts;
  authorized approval runs identity→policy→approval→execute and is
  recorded in the shared ledger; unauthorized (identity-mismatched)
  approval fails closed with a denied ledger entry, draft untouched;
  Activity Timeline boundary reads back exactly what approval wrote,
  scoped per-user (a second user's events proven not to leak); a
  failed execution (approving a nonexistent draft) is recorded failed
  and IS visible through the Activity boundary, not hidden; a second
  approval on an already-approved draft cannot execute twice, draft
  state unchanged from the first approval.
VERIFIED:
- pnpm --filter jhadina-web type-check: clean.
- pnpm vitest run: 91/91 (85 existing + 6 new).
- pnpm --filter jhadina-web build: real Next.js production build
  succeeds; /activity and /api/growth/activity both present in the
  route manifest.
- pnpm --filter jhadina-web lint: clean except one new
  react-hooks/exhaustive-deps warning on growth/page.tsx's existing
  useEffect (same warning class already accepted elsewhere in this
  codebase, e.g. AudioPlaybackBridge.tsx; not fixed here to avoid a
  broader refactor of that page's effect structure outside this
  slice's scope).
- Grep-confirmed no "use client" component or Pages Router component
  imports the ledger, @jhadina/action-core, or
  governed-approval-runtime — only the two new API routes do.
ARCHITECTURAL IMPACT:
- Closes a real, previously-shipped bug (the identity-header mismatch)
  that meant the governed Growth approval path, despite compiling and
  passing SP-1's tests, could not have completed successfully against
  any real authenticated user until now.
- Activity Timeline is real but explicitly non-durable by design
  decision (in-memory ledger) — will not survive a process restart or
  necessarily be visible across separate serverless instances in a
  real deployment. This is the intentional scope of this milestone,
  not an oversight; the next durability milestone is named below.
COMMIT: PR #66, merged as 99c51b3
NEXT: PL-1 post-merge verification, then a narrowly-scoped durability
swap (in-memory AuditLedger → existing SupabaseAuditLedger, audited
first — dependency composition only, not new architecture) before
Commerce sandbox payments.
```

**Frozen gates:** unchanged. JH-007, JH-022–024, JH-026, JH-028/033/034,
JH-032 remainder, JH-038 checkout decision, JH-039 remainder, JH-041,
JH-043, JH-046 — none touched.

### PL-1 post-merge verification

**Status:** DONE — all checks passed on `main` @ `99c51b3`/`9c45d51`.
main contains the merge SHA; working tree clean; `/growth` confirmed
using `getCurrentUserId()` for every fetch; `PersonalCommandFeed`'s
Growth card confirmed linking to `/growth`; 91/91 tests re-run clean on
merged `main` (including the 6 lifecycle tests against the real
composition root); grep-confirmed the ledger boundary holds (only the
two API routes import `governed-approval-runtime`); grep-confirmed no
literal `user_demo` header send remains anywhere in the governed path
(only explanatory comments referencing the old bug); full CI green.

### PL-2 — Durability: in-memory AuditLedger → SupabaseAuditLedger

**Status:** DONE
**Objective:** `UI → governance → InMemoryAuditLedger` becomes
`UI → governance → SupabaseAuditLedger`. No UI redesign, no new
governance primitives, no new parallel audit system, no unrelated
Supabase schema work.

**Pre-build audit (required before any code):** `SupabaseAuditLedger`
(action-core) is a clean, already-correct, already-tested
implementation of `ActionLedger` — the class itself needed no changes
to its `append()` contract. But its one required RPC,
`append_jhadina_audit_event`, and any backing table did not exist
anywhere in `supabase/migrations` — the repo has exactly one migration
file, and it's for a completely unrelated ledger
(`jhadina_evolution_run_ledger`, evolution-core's own run-event log).
Live introspection via the Supabase MCP tool was attempted but blocked
by a non-interactive permission gate; the audit is grounded in the
migrations directory, the same ground truth CI's "Supabase Preview"
check deploys from. Conclusion, surfaced before writing code: the
*contract* is satisfied, the *schema* is not — some new migration is
unavoidable for real durability, not a pure dependency-composition
change with zero schema. **User decision: minimal migration, mirroring
the existing evolution-ledger pattern.**

A second real gap surfaced during the audit: `ActionLedger` (the
interface `SupabaseAuditLedger` implements) is append-only by design —
no `list()` method exists on the interface, and `SupabaseAuditLedger`
itself had no read path at all before this milestone. Activity
Timeline's read side therefore needed its own addition, not a bundled
freebie from swapping the write side. Not "unrelated Supabase schema
work" (it's the same table, necessary to keep Activity Timeline
working) and not a "new parallel audit system" (it's the one ledger's
own read capability, added to match `InMemoryActionLedger`'s existing
shape) — reported as part of the honest scope of this decision rather
than a fresh fork requiring its own sign-off.

**Completion report:**
```
TASK: PL-2
STATUS: DONE
CHANGED:
- supabase/migrations/20260814000000_append_jhadina_audit_event.sql
  (new): jhadina_audit_event table + append_jhadina_audit_event +
  list_jhadina_audit_events, mirroring
  append_jhadina_evolution_run_ledger's established pattern (advisory
  lock -> next sequence -> sha256 hash chain over the event + previous
  hash), partitioned per domain rather than per run. RLS enabled with
  zero policies; all access is through these two security definer
  functions, granted to `authenticated` (not service_role — no new
  credential introduced). Both functions self-enforce
  auth.uid() = the actor being written or read as a database-level
  backstop behind the application's own identity verification, not a
  replacement for it.
- packages/jhadina-action-core/src/supabase-audit-ledger.ts: added
  list(filter: {domain, actorId}) — scoped to exactly one domain/actor
  pair, never "all events," calling the new list_jhadina_audit_events
  RPC. Not part of ActionLedger (append-only by design); mirrors
  InMemoryActionLedger's own list() in spirit. The reconstructed
  event's `type` is read back from the stored `capability` column — a
  documented, narrow caveat: faithful only when the ledger wasn't
  configured with a many-to-one capabilityForType mapping, true for
  every current caller since each domain's action `type` already *is*
  its capability string.
- packages/jhadina-action-core/src/supabase-audit-ledger.test.ts:
  extended with list() coverage against a fake RPC client.
- apps/jhadina-web/src/lib/growth/durable-audit-ledger.ts (new):
  createGrowthAuditLedger() — constructs a SupabaseAuditLedger wrapping
  the same request-scoped Supabase client createRequestIdentityVerifier()
  already builds (session cookies via @supabase/ssr). No service-role
  client, no new credential.
- apps/jhadina-web/src/lib/growth/governed-approval-runtime.ts:
  InMemoryActionLedger replaced with a per-call SupabaseAuditLedger
  (its underlying client is request-scoped, so it can no longer be a
  module-level singleton the way the in-memory one was — the one
  structural change beyond a pure constructor swap). Approval receipts
  deliberately stay in-memory/process-local — explicitly out of scope
  for this milestone, only the audit ledger changed. The
  identityVerifierOverride param from PL-1 became a small overrides
  object also accepting a ledger override, for the same reason (real
  Supabase calls have no meaning in a test process).
- apps/jhadina-web/src/lib/growth/governed-approval-runtime.test.ts:
  rewritten against a FakeAuditRpcClient that models the real
  migration's actual behavior (sequential per-domain inserts,
  domain+actor-scoped reads) rather than a client that always returns
  success — same discipline as every reference adapter this pass. All
  10 lifecycle points re-verified against the durable path. One test
  (#4, unauthorized approval) needed a real fix, not a mechanical
  port: the denied event is recorded under the *claimed* (unverified)
  actor, so it correctly does not appear in the real, verified user's
  own Activity read — the original assertion was checking the wrong
  boundary; fixed to inspect the ledger's write-side state directly
  for that case, and to separately assert the mismatched claim never
  leaks into the verified user's own activity view.
- No changes to any API route, any UI component, or ActionExecutor.
VERIFIED:
- pnpm --filter @jhadina/action-core type-check + test: clean, 9/9
  (was 8/8 — one new subtest for list()).
- pnpm --filter @jhadina/money-core type-check + test: clean, 11/11
  unchanged (money-core also depends on action-core; confirmed
  unaffected).
- pnpm -r type-check: 22/23 clean (pupsonstuff's pre-existing,
  unrelated vitest-types failure, same as every prior check this
  pass).
- pnpm vitest run (jhadina-web): 91/91 unchanged.
- pnpm --filter jhadina-web build: real production build succeeds.
- pnpm --filter jhadina-web lint: clean (same 4 pre-existing warnings
  as PL-1, none new).
- Grep-confirmed: no client component imports the ledger,
  @jhadina/action-core, or durable-audit-ledger directly. Grep-confirmed
  no SERVICE_ROLE/service_role credential introduced anywhere.
ARCHITECTURAL IMPACT:
- Activity Timeline now survives process restarts and is visible
  across separate serverless instances — the limitation PL-1 explicitly
  flagged as out of scope is closed.
- SupabaseAuditLedger.list() is a real, reusable addition to a shared
  FOUNDATION package — the next domain that wants a durable, readable
  audit trail (Money, Commerce, once governed) doesn't need to
  reinvent this.
COMMIT: PR #67, merged as 69692a4
NEXT: post-merge verification, then Commerce sandbox-payment milestone.
```

**Post-merge verification:** DONE. main contains the merge SHA; working
tree clean; durable audit path confirmed genuinely wired at the
composition root (`governed-approval-runtime.ts` uses
`createGrowthAuditLedger()`/`SupabaseAuditLedger` by default in both
the write and read paths — `InMemoryActionLedger` no longer appears in
any growth production code path); migration/RPC security posture
confirmed: RLS enabled + `revoke all` from `public`/`anon`/`authenticated`
on the table, both RPCs `security definer` + revoked from `public` +
granted only to `authenticated`, each independently enforcing
`auth.uid() = p_actor_id`. One real finding surfaced while confirming
the wiring: `listGovernedGrowthApprovalAuditTrail` (SP-1's original
in-memory-ledger accessor) was fully dead — superseded by PL-2's real
read boundary, zero callers left anywhere. Removed on PR #68, merged as
`bb34a27`, rather than leaving an unwired duplicate behind — same
discipline as removing `MoneyCapabilityPolicy` in Architecture
Checkpoint #2. Re-verified after that cleanup: no production reference
to the old accessor remains; the durable path still works for both
append and read (91/91 tests, including the full PL-2 lifecycle suite,
re-run clean on fully-synced `main`); the migration file was untouched
by the cleanup (confirmed via diff) so the security boundary is
unchanged. **Durable-audit milestone (PL-1 + PL-2) is complete.**

**Frozen gates:** unchanged.

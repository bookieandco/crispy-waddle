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
**Status:** QUEUED (not started — DISCOVER phase only)
**Branch:** none yet
**Objective:** Shodan read-only security connector
(`shodan.host.read`, `shodan.internetdb.read`, `shodan.dns.read`,
`shodan.search.read`, `shodan.history.read`), adapter-bounded, evidence
not conclusions, no active scanning.
**Dependencies:** JH-001, JH-002 (needs the real spine to exist first —
this was previously specified against packages that don't exist in this
repo yet: `jhadina-action-core`, `provider-core`, `security-core`. Those
need to be found-or-built as part of JH-002/JH-003, not assumed.)
**Definition of Done:** Not yet defined — this needs a DISCOVER pass
(does anything like this already exist?) before it gets a real Definition
of Done.
**Verification:** N/A yet.
**Next Step:** Run DISCOVER → AUDIT before writing any code.

### JH-013
**Priority:** P3
**Status:** QUEUED (not started — DISCOVER phase only)
**Branch:** none
**Objective:** "Communications stack" end-to-end wiring (Command API →
Policy → Planner → Comms Core → Transport Registry → Reticulum Adapter →
Reticulum, and the inbound/evidence paths back).
**Dependencies:** JH-001, JH-002
**Definition of Done:** Not yet defined. **Flag:** none of the named
components (Command API, Communications Core, Communication Planner,
Transport Registry, Reticulum Adapter, Device/Identity Registry) were
found anywhere in this repository as of this file's creation. Before
this becomes a real task, someone needs to confirm whether this work
exists on a branch not yet surfaced, or whether it's still purely
conceptual. Don't start implementation from the brainstorm description
alone.
**Verification:** N/A yet.
**Next Step:** DISCOVER: search all 90 branches for any of the named
component names before assuming a from-scratch build.

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
**Status:** QUEUED
**Branch:** `feat/jhadina-growth-engine` (PR #7) — `packages/growth-core/**`
**Objective:** Standalone attribution/creative-brief/customer-LTV/
economics/experiments/lineage engine (20 files, own package.json).
**Dependencies:** JH-001
**Flag:** Nothing in PR #7 (including the growth slice that did merge)
actually imports `@jhadina/growth-core` — it's fully unwired. Audit
should establish whether this supersedes/relates to JH-015's simpler
in-memory engine before deciding how it's meant to connect.
**Next Step:** Not yet audited.

### JH-026
**Priority:** P2
**Status:** QUEUED
**Branch:** `feat/jhadina-growth-engine` (PR #7) —
`apps/jhadina-studio-native/**`, `apps/jhadina-web/src/lib/studio/**`,
`services/{wav2lip,physics-service,rig-service,tracking-service,
studio-mastering}/**`
**Objective:** Studio AI-actor/video pipeline — GPU video processing,
character DNA/appearance/behavior runtime, physics, lip-sync,
voice-sync, rig/tracking, native Swift AV code, and five new Python
microservices.
**Dependencies:** JH-001
**Flag:** By far the largest and most speculative of the deferred
surfaces — native mobile code plus multiple new deployable services.
Given `docs/JHADINA_WORK_QUEUE.md`'s EXPERIMENT lane rule ("nothing
here is authorized to become FOUNDATION or INTEGRATION without an
explicit human decision"), this needs a human call on lane placement
and deployment/infra implications before any implementation work,
not just a merge-order audit.
**Next Step:** Human scoping decision, then DISCOVER/AUDIT.

### JH-027
**Priority:** P2
**Status:** QUEUED
**Branch:** `feat/jhadina-growth-engine` (PR #7) —
`apps/jhadina-web/src/lib/publishing/**`
**Objective:** Publishing engine — fiction/creative-writing workflow,
KDP intelligence, research library and engine.
**Dependencies:** JH-001
**Next Step:** Not yet audited.

### JH-028
**Priority:** P2
**Status:** QUEUED
**Branch:** `feat/jhadina-growth-engine` (PR #7) —
`apps/jhadina-web/src/lib/money/{needsAttentionEngine,
plaidFinancialData}.ts`, `apps/jhadina-web/src/app/money/command-center/page.tsx`,
`apps/jhadina-web/src/app/api/money/financial-data/route.ts`
**Objective:** Plaid-backed financial snapshot provider and
needs-attention engine, wired to a money command-center page.
**Dependencies:** JH-001
**Flag:** Handles real financial data via a third-party provider
(Plaid). Per `docs/DO_NOT_BUILD.md` ("Direct LLM authority over
money," "Bypassing the Policy Engine ... or audit ledger"), this needs
explicit confirmation it's read-only/observation-only and routes
through the existing Policy Engine boundary before merging, not an
assumption from the branch's own code.
**Next Step:** Not yet audited — security/policy review first.

### JH-029
**Priority:** P2
**Status:** QUEUED
**Branch:** `feat/jhadina-growth-engine` (PR #7) —
`apps/jhadina-web/src/lib/{shopping,cooking,opportunities}/**`,
`apps/jhadina-web/src/app/opportunity/page.tsx`,
`apps/jhadina-web/src/app/api/opportunities/**`
**Objective:** Shopping watchlist, cooking/recipe/drink recommendation
engines, and an Opportunity Command Center (side-income discovery with
an approve-only, no-side-effect action model).
**Dependencies:** JH-001
**Next Step:** Not yet audited.

### JH-030
**Priority:** P2
**Status:** QUEUED
**Branch:** `feat/jhadina-growth-engine` (PR #7) —
`apps/jhadina-web/src/lib/campaign/polling.ts`,
`apps/jhadina-web/src/app/campaign/polls/page.tsx`
**Objective:** Polling intelligence dashboard.
**Dependencies:** JH-001
**Next Step:** Not yet audited.

### JH-031
**Priority:** P2
**Status:** QUEUED
**Branch:** `feat/jhadina-growth-engine` (PR #7) —
`apps/jhadina-web/src/components/JhadinaShellNavigation.tsx`,
`apps/jhadina-web/src/components/jhadina/UniversalJhadinaButton.tsx`,
`apps/jhadina-web/src/app/layout.tsx`, `apps/jhadina-web/src/components/
jhadinaTv/MiniPlayer.tsx`
**Objective:** Five-button shell navigation (with a "Worlds" dropdown)
and a persistent JhadinaTV mini player, mounted into the root layout.
**Dependencies:** JH-001, JH-014
**Human gate:** This surface's own history (commit `8b96d19` on PR #7)
deletes `apps/jhadina-web/pages/index.tsx` — the homepage JH-014
explicitly preserved as canonical `/` — in favor of the Supabase-auth
placeholder page JH-014 removed. Cannot be merged via automatic git
resolution; needs an explicit decision on how five-button nav mounts
onto the already-merged homepage, the same way the two music-core
generations required explicit comparison rather than auto-resolution.
**Next Step:** Not yet audited. Do not merge without reconciling
against JH-014's resolution first.

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
**Status:** QUEUED
**Branch:** `fix/vercel-build-jhadina-web` (PR #4) —
`apps/jhadina-web/src/lib/growth/{agentReachProvider,scheduler,
trendScout,trendScoutWorker,webTrendProvider}.ts`,
`apps/jhadina-web/src/app/api/growth/{drafts/versions,ideas,
trends/scout}/route.ts`
**Objective:** A third, more elaborate Growth Engine generation —
trend scouting, idea generation, agent-reach provider, scheduling —
built on the same `types.ts`/`engine.ts` shape as JH-015 but
substantially extended.
**Dependencies:** JH-001, JH-015
**Flag:** Three growth-engine generations now exist: JH-015 (merged,
simple in-memory), JH-025 (deferred `growth-core` package, unwired),
and this one. Audit needs to establish which is authoritative before
building further — don't assume they compose.
**Next Step:** Not yet audited.

### JH-033
**Priority:** P2
**Status:** QUEUED
**Branch:** `fix/vercel-build-jhadina-web` (PR #4) —
`apps/jhadina-web/src/lib/money/{financialAttention,
financialDataProvider,plaidAdapter}.ts`,
`apps/jhadina-web/src/app/money/{command-center,withdraw}/page.tsx`
**Objective:** Plaid-backed financial data/attention engine plus a
money command-center and withdrawal page.
**Dependencies:** JH-001
**Flag:** Same domain as JH-028 (also Plaid, also money command
center), from a different branch generation — likely overlapping or
divergent implementations of the same feature. Needs consolidation
audit against JH-028, not independent implementation. Also handles
real financial data and a *withdrawal* flow specifically — per
`docs/DO_NOT_BUILD.md` ("autonomous or automatic movement of funds ...
needs an explicit human-authorized action through the existing
approval/policy path, every time"), this needs explicit Policy Engine
routing confirmed before merging.
**Next Step:** Not yet audited — security/policy review first,
reconciled against JH-028.

### JH-034
**Priority:** P2
**Status:** QUEUED
**Branch:** `fix/vercel-build-jhadina-web` (PR #4) —
`apps/jhadina-web/src/lib/music/{distribution,distributionAdapter,
moneyCoreBridge,moneyCoreWithdrawal,royaltyLedger,
royaltyStatementImporter}.ts`,
`apps/jhadina-web/src/app/music/{release-center,royalties}/page.tsx`
**Objective:** Music distribution and royalty-ledger domain, bridged
to `money-core`, including a withdrawal path.
**Dependencies:** JH-001, JH-006 (money-core)
**Flag:** `moneyCoreWithdrawal.ts` moves money — same DO_NOT_BUILD
policy-routing concern as JH-033. Needs security/policy review, not
just a functional audit.
**Next Step:** Not yet audited — security/policy review first.

### JH-035
**Priority:** P2
**Status:** QUEUED
**Branch:** `fix/vercel-build-jhadina-web` (PR #4) —
`apps/jhadina-web/src/lib/film/{filmPlanner,sceneExtend}.ts`
**Objective:** Film planning / scene-extension logic. Scope and
intended UI surface unclear — no page/route wires to these in the
diff.
**Dependencies:** JH-001
**Next Step:** Not yet audited — establish what (if anything) consumes
this before treating it as a real feature slice.

### JH-036
**Priority:** P2
**Status:** QUEUED
**Branch:** `fix/vercel-build-jhadina-web` (PR #4) —
`apps/jhadina-web/pages/index.tsx`, `apps/jhadina-web/components/BottomNav.tsx`
**Objective:** Alternate homepage — a `BottomNav`-driven feed (Music /
Opportunity / Jhadina cards), rewriting `pages/index.tsx` from its
then-current trivial "Loading..." placeholder.
**Dependencies:** JH-001, JH-014
**Human gate:** This branch forked before `PersonalCommandFeed` (the
homepage JH-014 confirmed and preserved as canonical `/`) existed on
`main` — it was never aware of that decision, not in conflict with it
on purpose. Same collision shape as JH-031: two independently-built
homepages, neither aware of the other, requiring explicit comparison
before either replaces the other. Do not merge via automatic git
resolution.
**Next Step:** Not yet audited. If picked up, compare directly against
JH-014's `PersonalCommandFeed` and JH-031's five-button-nav proposal
together — three homepage directions now exist and should be
reconciled once, not serially.

### JH-017
**Priority:** P2
**Status:** ACTIVE
**Branch:** PupsonStuff chain — `pupsonstuff-import` (#9) ←
`claude/pupson-repo-audit-xmahtp` (#14) ← `feat/pupsonstuff-engine-v5`
(#10) and `feat/pupsonstuff-mobile-stage` (#11) ← `feat/pupsonstuff-pod-core` (#12)
**Objective:** Integrate the PupsonStuff boutique vertical (product
engine, mobile stage, print-on-demand core).
**Dependencies:** JH-001
**Definition of Done:** Not yet audited — this chain has its own internal
merge-order question (4 stacked PRs) that deserves the same kind of pass
already done for the FOUNDATION lane before treating it as ready.
**Next Step:** Dedicated mini merge-order audit of #9/#10/#11/#12/#14.

### JH-018
**Priority:** P2
**Status:** QUEUED
**Branch:** `feature/capital-lab-ui` (PR #3)
**Objective:** Jhadina Capital Lab mobile UI.
**Dependencies:** JH-001
**Next Step:** Not yet audited.

### JH-019
**Priority:** P2
**Status:** QUEUED
**Branch:** `feat/jhadina-entertainment-intelligence` (PR #16)
**Objective:** Entertainment intelligence feature.
**Dependencies:** JH-001
**Next Step:** Not yet audited.

### JH-020
**Priority:** P2
**Status:** QUEUED
**Branch:** Commerce/marketplace bundle — `feat/delivery-compliance-gate`
(#17), `feat/order-fulfillment-core` (#18),
`feat/commerce-pos-inventory-contracts` (#19),
`feat/jhadina-intelligence-contract` (#20),
`feat/checkout-reservation-orchestrator` (#21), `feat/offer-engine`
(#22), `feat/placementos-vertical-slice` (#23)
**Objective:** Marketplace/commerce vertical — 7 independent PRs, all
based on `main`, all plausibly related to each other (checkout,
inventory, offers, fulfillment, delivery compliance) but with no
declared dependency ordering between them.
**Dependencies:** JH-001
**Definition of Done:** Not yet audited. **Flag:** same "related but not
stacked" pattern as the mining trio (JH-022/023/024) — merging these
independently risks silent conflicts between them that per-PR CI can't
catch.
**Next Step:** Dedicated mini merge-order audit of #17–#23 before
merging any of them.

### JH-021
**Priority:** P2
**Status:** QUEUED
**Branch:** `feat/jhadina-growth-channel-adapters-v9` (PR #41)
**Objective:** Complete the advertising intelligence loop.
**Dependencies:** JH-001, JH-015
**Next Step:** Not yet audited.

---

## EXPERIMENT

### JH-022
**Priority:** P3
**Status:** QUEUED
**Branch:** `feat/jhadina-energy-opportunity-core` (PR #32)
**Objective:** Deterministic profitability/authorization *policy* logic
for an energy/compute opportunity core. Explicitly defers real miner
execution, credentials, wallet custody, and hardware I/O — this PR does
not mine anything or execute background workloads.
**Dependencies:** JH-001
**Definition of Done:** CI already green (`energy-opportunity-core` check
×2, Vercel preview). Confirm no execution/credential/wallet code crept
in before merging.
**Verification:** `pnpm test`, `pnpm lint`, `pnpm build`, CI (already passing — re-verify post JH-001).
**Next Step:** Merge after JH-001. See `docs/DO_NOT_BUILD.md` — this
task's boundary is load-bearing, not decorative.

### JH-023
**Priority:** P3
**Status:** QUEUED
**Branch:** `ci/reorg-safe-bitcoin-checkpoint` (PR #39)
**Objective:** Reorg-safe, restart-safe checkpoint scanner for automatic
Bitcoin payout *discovery* (read-only — no wallet access, no signing).
**Dependencies:** JH-022 (related domain, not currently stacked in git —
merge one at a time and re-test rather than assuming independent green
checks compose cleanly)
**Verification:** `test-and-typecheck` CI (already passing).
**Next Step:** Merge after JH-022, re-run CI.

### JH-024
**Priority:** P3
**Status:** QUEUED
**Branch:** `ci/profitability-snapshot` (PR #38)
**Objective:** Realized-profitability snapshot adapter with idempotent
snapshot persistence.
**Dependencies:** JH-023
**Verification:** `energy-opportunity-core` CI check (already passing).
**Next Step:** Merge after JH-023, re-run CI.

### Explicitly rejected (not tasks)

Actual Bitcoin/Dogecoin miner execution software, a mining-pool server
(`miningcore`), and a wallet private-key extraction tool (`pywallet`)
were proposed in chat and declined. See `docs/DO_NOT_BUILD.md`. This
lane tracks the read-only, policy-gated observation layer only
(JH-022/023/024) — nothing here mines, signs, or moves funds.

---

## Needs a human decision before filing as a task

- **PR #2** (`copilot/phase-1-1a-day-2-integration`, "Align jhadina-web
  JANET integration with the documented Day 2 contract") — open since
  2026-08-05, draft, likely superseded by the much larger amount of
  JANET-adjacent work since (core-spine, evolution-adapter). Recommend
  closing rather than filing as a task, but that's Dorian's call, not
  mine to make unilaterally given real work went into it.

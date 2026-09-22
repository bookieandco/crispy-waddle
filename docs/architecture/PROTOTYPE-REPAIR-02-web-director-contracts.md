# PROTOTYPE-REPAIR.2 — Web / Director contracts

Date: 2026-09-22. Base main: `570d1552288714e6fba2ad7b75f4fc4cd4ae3d18`.
PR: #529. Music repair #499 is now merged.

## Changes

- Export five existing Director modules consumed by the Web repositories: generated-asset-resolver, generation-execution, generation-repository, generation-submission-repository and generation-task.
- Distinguish Supabase table builders from filters returned by select, and describe awaited SDK responses as PromiseLike.
- Replace composition-root double casts with a read adapter that preserves project/run/board filters, version ordering, limits and error propagation. Keep Director Core independent of the SDK.
- Use the installed SDK's from surface for the Web review repository and remove its result double cast.
- Add four tests using the real SDK with intercepted HTTP requests: scoped latest-binding and gate reads; review reads; denied queries; version-bound review RPC.

## Verification

- Frozen lockfile installation passed using pnpm 8.15.9, with install scripts disabled. No dependency/lockfile upgrade.
- Jhadina Web type-check: PASS, zero diagnostics on this base plus repair. Earlier 95/22 diagnostic counts were from older main snapshots and are superseded.
- Director Core type-check: PASS.
- Jhadina Web production build: PASS (exit 0); compiled, type/lint gate completed, generated 64/64 static pages and finished trace collection. Existing hook/image warnings and dynamic-route diagnostics were non-fatal. This is a local build, not a deployment.
- Targeted Web tests: PASS, 8 tests in 2 files (4 SDK contracts and 4 provider factory tests).
- Full Director suite: NOT GREEN. Both the unmodified main worktree and repair have the same 16 failure entries: 15 failing tests plus one unloadable suite. Both report 148 passing tests / 41 passing files; 7 failing files. This patch does not introduce a new failing test name.
- git diff --check: PASS.

The full Director failures cover stale execution/submission leases and atomic transitions, coordinator/reconciler recovery, generation catalog compatibility, FFmpeg cancellation timeout, and unresolved @jhadina/action-core in studio-governed-action tests. They remain launch blockers and require separate repairs. A passing Web type-check does not certify them.

Tests intercept HTTP locally; no live database writes, provider generation, spending or deployment was performed. Native dependency scripts were not verified. Runtime/browser/provider acceptance remains outstanding.

## Next repair batch

Repair the failing Director execution/submission lease and recovery tests without disabling authorization or idempotency gates. Separately resolve the action-core test import, catalog compatibility assertion and FFmpeg cancellation timeout. After that, run the complete workspace launch gate and verify the deployed SHA with provider credentials.

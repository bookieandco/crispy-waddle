# PROTOTYPE-REPAIR.1 — Music compilation and regression repair

Date: 2026-09-21. Base: `365ed8c4a8959b11e84900469f976e7bd3cea738`.

Status: Music source gate passes locally; whole-system launch remains blocked.

## Repairs

- Resolve ambiguous public RestorationVersion/MusicalEventKind exports while retaining explicit aliases for the distinct ledger/protected-event types.
- Use the supplied vocal decomposition, preserve narrowed damage regions, map intent hypotheses to listening descriptors, and declare execution output artifact provenance.
- Validate supported native formats before passing them to VST3/CLAP hosts; compare worker replies against the IPC protocol constants rather than nonexistent binding fields.
- Send the automation payload rather than nesting an entire request in that payload.
- Reject experiment authorization for a different case or source version before calling the runner.
- Register six previously incompatible node:test suites with the package's Vitest runner; import missing test APIs; repair descriptor/lifecycle fixtures and assertions that targeted the wrong validation path. Keep strict compiler checks enabled.
- Correct the incomplete-probability fixture: a single outcome with likelihood 1 under each hypothesis is a complete model, not an invalid one. Use incomplete per-hypothesis mass in the rejection test.

## Validation

- pnpm 8.15.9 frozen-lockfile install passed; lockfile unchanged. Installation used --ignore-scripts, so this does not certify native dependency build scripts.
- Music Core `tsc --noEmit`: passed.
- Music Core `vitest run`: 37 files, 145 tests passed, including native supervisor lifecycle integration, forbidden worker authority, automation binding, vocal source isolation and rejection of mismatched case/source authorization without invoking the runner.
- `git diff --check`: passed.
- Local Node: 24.19.0; CI declares Node 20. Remote checks must confirm the supported runner environment.

## Remaining launch work

The broader workspace type-check is not green. Jhadina Web exposes Director/Supabase adapter type mismatches and unresolved Director subpath imports, among other errors. An initial broad check also encountered package configuration/missing-module errors; some were collected before a full workspace dependency-linking pass, so do not interpret their raw count as a verified count of source defects.

Next: reconcile Director exports and Web repository interfaces on current main, then continue the full immutable release gate. The Music route identity/persistence findings from the audit remain separate open work. This change does not certify live audio processing, production deployment, or provider/device acceptance.

Leave this repair PR open for integration review. Do not bulk-merge old Music/Director branches or weaken the launch gate to bypass subsequent failures.

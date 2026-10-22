# JH-DIRECTOR.RECAST.LIVE.39–.42 — Migration drift, immutable reviews, and first-preview QA

Checkpoint: October 21, 2026. Draft PR #1432. Source-only development and read-only Supabase inspection.

## LIVE.39 — Refreshed migration evidence and staging SQL guard
Read-only Supabase queries reconfirmed the Jhadina project is accessible, yet director_project_inputs and director_recast_review_receipts are absent. The project branch inventory still reports MIGRATIONS_FAILED. The latest recorded migration is now 20261021232258, whereas no migrations are recorded in the October 4–5 window containing the canonical Workstation project-input source migration.
The precise failed Supabase branch replay statement is not established. Do not repair migration history, reset the branch, create a possibly billable staging branch, or execute production DDL without separate authorization.
The nonexecuted review-registry SQL proposal now requires server-issued UUID receipt IDs, explicit revocation and re-grant of service-role table privileges, server-bounded created_at/reviewed_at timestamps, and an index optimized for immutable review history. Updated static schema tests enforce these invariants. Actual SQL/RLS trigger execution has not been tested in a disposable Supabase database.

## LIVE.40 — Revocation ordered by database append time
Previously, review supersession used the human reviewedAt timestamp. A later rejected receipt could be hidden by an earlier approval with a larger declared reviewedAt. The resolver now uses the database created_at append time when present and rejects mixed append-time provenance. The production reader now requires created_at on every stored record; its review digest and scoped asset hashes must also verify.
New regressions confirm that a later append-time veto blocks even if its reviewedAt predates the prior approval. No old approval is resurrected after a veto; missing or ambiguous histories remain blocked.

## LIVE.41 — Owner revocation and authenticated staging receipt readback
The source-only staging adapter now requires an independent stored-row readback after insertion and confirms project/owner, media IDs/hashes, review type, status, reviewer and evidence seal. An insert acknowledgement alone is insufficient.
A separate source-only owner revocation manifest records explicit consent withdrawal as an append-only rejected rights/voice/tracking review. This does not authorize client-submitted revocations or write to Supabase. It does not cover media-probe records, which require separate trusted-probe handling.
The staging sink is still dependency-injected and can be exercised with fake records; there is no live staging writer, public API route, Supabase SQL mutation, or operator spend approval.

## LIVE.42 — Hash-sealed offline preview QC intake
A new local review package combines independently hashed original/preview files, ffprobe video metadata comparison, and ffmpeg decoded-original-audio integrity checks. Valid local media may be marked ready for *manual* review only; identity, lip-sync, scene-motion fidelity, permission/rights, QC and owner publication approval remain false.
This is an intake contract for an already rendered clip, not a character-swap renderer. The test suite includes altered audio, duration drift, corrupted source hashes, and explicit non-approval assertions.

## Operational order
1. Extract the exact failed statement from Supabase Branches -> View logs and the matching Postgres log record. Reconcile migrations against live schema rather than guessing a missing migration caused the replay failure.
2. Obtain explicit approval for any staged resource cost; confirm healthy disposable staging, apply canonical project inputs, audit grants and RLS, and exercise rejected/approved receipt timestamps and append-only triggers with disposable data.
3. Independently verify real media probes, human track review, voice timing, likeness rights and ownership. Only then commission an approved cost-capped character-replacement preview through the canonical ActionExecutor.
4. Capture the output in the offline preview QC package, independently assess visual identity and lip-sync, and complete a physical iPhone owner review before publishing.

No merge, deployed change, live database write, external GPU job, payment, video rendering or publication was undertaken.
Source-only CI is not staging or device acceptance.

# GOOGLE-HOMEBASE-LIVE.4 — proof of exact recovered application data

**Scope:** synthetic PostgreSQL recovery confidence, not live Supabase or offsite Drive recovery.

The LIVE.3 [synthetic integration](./GOOGLE-HOMEBASE-LIVE-3-2026-10-07.md) actually restored one application table using PostgreSQL and Restic. However, a table count alone is insufficient for a recovery integrity acceptance test: a restore could contain empty, incorrect or unrelated application data while still counting as one table.

LIVE.4 strengthens the **existing** backup/restore helpers rather than introducing another recovery system.

- When the synthetic drill generates its 32-character random canary marker, it now keeps the marker in process memory and passes it to `restore_into_disposable_postgres` as `expected_synthetic_marker`.
- The isolated Postgres restore executes a fixed, non-interpolated readback query: `SELECT count(*), min(marker), max(marker) FROM public.jhadina_synthetic_canary`. It must return exactly **one row** and its original marker in both comparisons.
- A marker that is not exactly 32 lowercase hexadecimal characters is rejected **before any Docker call**. No externally supplied SQL is executed.
- Deletion of the disposable restore container must succeed; cleanup failures are surfaced as errors rather than producing a false recovery success.
- Hermetic regression tests reject a malicious marker, wrong recovered row content and failed container cleanup. The actual GitHub Actions synthetic Postgres/Restic workflow is rerun on the new PR head to prove behavior using real engines, not only mocked calls.
- The LIVE.4 receipt adds `synthetic_exact_row_contents_restored_verified=true` only after the real query succeeds. `production_backup_restored=false`, `supabase_live_data_covered=false`, `offsite_drive_backup_verified=false`, and `long_term_password_recovery_verified=false` remain unchanged.

**Execution location:** disposable GitHub Actions environment with **generated test data only**. No credentials, private records, Google Drive OAuth, RunPod GPU, cost-incurring new machine, or production changes.

**Next actual production blocker:** [Issue #1144](https://github.com/bookieandco/crispy-waddle/issues/1144), identifying an already trusted and durable owner-controlled host, separate machine Google OAuth, recoverable Restic secret custody, and scoped non-synthetic source backup and isolated restore.

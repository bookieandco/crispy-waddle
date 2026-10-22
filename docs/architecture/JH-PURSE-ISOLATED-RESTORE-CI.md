# JH-PURSE — synthetic independent-cluster restore rehearsal

Adds a CI-only fixture to the existing `Side Hustle Commercial Postgres` workflow, stacked on draft [#1462](https://github.com/bookieandco/crispy-waddle/pull/1462).

Run behavior: uses only the previously initialized disposable `jhadina_test` database, takes a synthetic `pg_dump -Fc`, starts a SECOND temporary `postgres:16-alpine` Docker cluster on loopback, restores there with `pg_restore --exit-on-error`, compares deterministic synthetic work-order record fingerprints and counts, and repeats two-tenant RLS and anonymous grant denial on the **restored** database. All five canonical commercial tables must exist with RLS after restore. No sample rows or passwords enter external services. The CI fixture refuses to run unless `CI=true` and `DATABASE_URL` matches its synthetic fixture value, and deletes its temporary archive and container at exit.

This **does not** back up, restore, connect to, or certify the actual Supabase SWLC production project. Actual offsite source backup, independent real-data restore, cross-user authenticated JWT checks, historical migration reconciliation and separate production DDL approval remain blockers. The existing CI test only rehearses the backup/restore mechanics against synthetic locally generated data.

As of 2026-10-22 05:45 UTC, the live database remained online but the five Side Hustle commercial tables were absent. The Drive `SWLC-POSTGRES-ENCRYPTED` folder was observed empty, while available `SWLC SAM` archival scripts concern a narrower export and cannot substitute for a complete Postgres recovery backup.

**External recovery decision:** Supabase documents paid-plan physical backups and a fee-bearing Restore to a New Project. Do not initiate that paid restore or any production DDL without explicit owner authorization. The source-only branch stack #1456 → #1460 → #1461 → #1462 → this PR remains the intact implementation path.

# JH-DIRECTOR.RECAST.LIVE.27–.30 — source-only recovery and acceptance

Date: 2026-10-21  
Repository: `bookieandco/crispy-waddle`  
PR: https://github.com/bookieandco/crispy-waddle/pull/1432

## Live read-only evidence

The connected **Jhadina** Supabase project reports `ACTIVE_HEALTHY`, but the only returned branch, `main`, has status `MIGRATIONS_FAILED`. Read-only `information_schema` / `to_regclass` checks showed:

| Relation | Present? |
| --- | --- |
| `public.jhadina_artifacts` | Yes |
| `public.director_project_memberships` | Yes |
| `public.director_cast_characters` | Yes |
| `public.director_character_appearance_variants` | Yes |
| `public.director_project_inputs` | **No** |
| `public.director_recast_review_receipts` | **No** |

The live migration registry returned **zero rows** for 2026-10-04 to 2026-10-05, despite the canonical project-input migration existing in GitHub as `supabase/migrations/20261004193000_director_workstation_project_inputs.sql`. The latest live migration entry returned was `20261015003629`. These findings do not prove the exact cause of the branch replay failure; the failed statement still requires log inspection.

See Supabase's official [MIGRATIONS_FAILED recovery guide](https://supabase.com/docs/guides/troubleshooting/branch-in-migrations-failed-status).

## Source implementations

- **LIVE.27 — migration inventory and runtime blocker:** New `recast-runtime-readiness.ts` and authenticated read-only `GET /api/director/recast/readiness` distinguish missing project inputs from absent receipt storage and uncommissioned worker/approval. Return no privileged IDs or tokens. The iPhone media picker fails closed when `director_project_inputs` is absent.
- **LIVE.28 — recovery preparation:** Static schema contracts, known migration-to-live drift, and a safe operator sequence below. **No history editing, failed-branch reset, migration apply, Supabase branch creation or SQL mutation.**
- **LIVE.29 — review persistence handoff:** `recast-review-insert-manifest.ts` creates an **unpersisted** UUID-bound, evidence-hashed append-only SQL insert manifest only from server-staged review material. No repository write endpoint is enabled; the reviewer/rights/probe evidence still requires independently verified server adapters before a real insert.
- **LIVE.30 — actual before/after file inspection:** `recast_preview_acceptance.py` compares two **existing** owner-admitted local video files by independent file hash and ffprobe dimensions, duration, and preview-audio presence; it does not generate a recast. The existing iPhone comparison component remains owner-local and cannot certify identity or lip-sync without independent QC.

## Ordered recovery sequence — operator approval required for mutations

1. **Read only:** inspect the Supabase branch workflow's failed migration step, relevant Postgres logs, actual `supabase_migrations.schema_migrations` rows, and the current schema. Record the failing SQL statement and related object existence. Do not assume `MIGRATIONS_FAILED` itself means Postgres is unhealthy.
2. **Reconcile:** compare repository migrations to the live migration registry and live schema for the missing October 4 project-input work. Plan corrective migrations on a separate branch; never mark a migration applied without proving its objects match; never reset production or rewrite migration history blindly.
3. **Price and approve staging:** check branching cost/plan, obtain explicit approval for any billable development branch, and use an isolated disposable environment. The current branch inventory did not establish an available healthy staging branch.
4. **Stage canonical Workstation inputs first:** on an authorized staging database, apply and validate the existing source migration for `director_project_inputs`. Verify owner/project FK and role binding, `anon` and `authenticated` denied, and required `service_role` grants. Prove clean artifact attachment and foreign-artifact rejection with disposable test data.
5. **Review receipt registry separately:** audit `docs/director/RECAST-REVIEW-REGISTRY-PROPOSAL.sql` for role permissions, RLS, immutable/append-only triggers, owner hash lineage and authenticated per-kind approval. Do not promote SQL solely because static tests pass; its source proposal is **not** a deployed migration.
6. **Commission evidence reviewer and approved preview transport:** bind actual independent tracking, source FFprobe, voice review, rights and consent to the exact three assets. Require per-job owner cost ceiling and canonical ActionExecutor authorization before GPU calls. No third-party processor credentials or paid compute are enabled by this PR.
7. **Acceptance:** use owner-supplied real footage and a separately generated approved preview, compare local hashes/metadata, confirm portrait iPhone playback, get measured visual/lip-sync QC, and obtain explicit owner timeline approval before any publishing.

### Read-only diagnostic SQL (not a migration)

```sql
select
  to_regclass('public.director_project_inputs') as inputs,
  to_regclass('public.director_recast_review_receipts') as reviews,
  to_regclass('public.jhadina_artifacts') as artifacts;

select version from supabase_migrations.schema_migrations
where version between '20261004000000' and '20261005235959'
order by version;
```

## Validation boundary

Static/GitHub CI results prove only source correctness. Physical iPhone acceptance, actual video replacement, lip-sync fidelity, a human review, a database insert, and a production render have **not** been demonstrated. The worker remains disabled; no merge, release, billable GPU or database mutation has been performed.

# GEV-CERT.01–.08 — Production recovery and certification handoff

**Audit date:** October 16, 2026 Pacific / October 17 UTC.
**Verdict:** Source-code sequence in review. Production certification BLOCKED.

Supabase repair issue: https://github.com/bookieandco/crispy-waddle/issues/1340
GEV-LIVE.01–.14 source baseline: PR #1339, merged as a6538c74e81e2fbe68f021cee1e12993165bc34b.

## Verified external evidence

- Vercel production-target deployment dpl_84kUAoZYA86CsrkijqU7QKLbMAAs is READY on exact SHA a6538c74e81e2fbe68f021cee1e12993165bc34b. Production alias: crispy-waddle-jhadina-web.vercel.app. READY does not certify authentication, OIDC, source availability or durability.
- Vercel project environment listing has no commissioned GEV host, exact approved hostname, camera/aircraft/vessel/FIRMS rights flags, or live-canary enablement.
- Swlc Supabase project kqbkaozfjubkjevdfvic reports ACTIVE_HEALTHY metadata; read-only SQL returns PostgreSQL 57P03: database system is not accepting connections, hot standby mode is disabled.
- Supabase PostgreSQL logs show repeated recovery and could-not-write pg_wal/xlogtemp due to No space left on device (examples 2026-10-17 01:00, 03:16 and 05:36 UTC). This is consistent with a disk-full WAL recovery loop. No destructive recovery attempted.
- Production HTTP owner-authenticated JSON probes were not verifiable from the execution environment; do not claim valid OIDC or anonymous denial. Historic six-table RLS audit must be repeated after SQL recovers.

## GEV-CERT ordered stage ledger

| Stage | Code / verification target | Real-world disposition |
| --- | --- | --- |
| .01 | Diagnose WAL/SQL; preserve data; mark Supabase audit issue #1340 | BLOCKED pending infrastructure disk/WAL recovery and backup assessment |
| .02 | Verify production SHA, owner-authenticated JSON, anonymous rejection, signed OIDC and six-table privileges | BLOCKED absent real owner/OIDC receipt |
| .03 | New owner-only GET /api/spatial/public-readiness for fixed USGS+CelesTrak sources, independent of paid camera/DB | SOURCE-TESTABLE; live provider acceptance unverified |
| .04 | Explicitly authorized owner-only USGS live canary, fresh observation and exact deployed SHA | BLOCKED: production database and authorization |
| .05 | Canonical immutable evidence hash + candidate and admission independent production DB readback | BLOCKED: no SQL or verified readback |
| .06 | Replay/outage/identity-revocation/tamper drills on real host | MOCKS EXIST; real drills BLOCKED |
| .07 | Real iPhone owner session, Ask and Spatial UI provenance and separation | UI EXISTS; device acceptance BLOCKED |
| .08 | Owner-only certification endpoint includes eight-stage evidence ledger plus existing ten-gate closeout | CODED; independent production signoff BLOCKED |

## Public-readiness semantics

- SOURCE_READABLE means only bounded public feeds returned structurally valid data; it is not a durable receipt or a verified event.
- Empty-but-valid sources are EMPTY, not observed. CelesTrak positions are derived estimates, never admitted ground truth.
- The separate public endpoint never activates private camera, aircraft, vessel, or FIRMS feeds and never writes to database.
- Production source gateway and owner-auth endpoint must still be independently verified on the exact deployed SHA.

## SUPABASE-AUDIT/REPAIR escalation and safe boundaries

1. Inspect project disk/WAL/storage metrics, PostgreSQL startup logs, planned backups and recovery points. Contact managed Supabase infrastructure support if WAL disk-full prevents startup; do not blindly restart, pause, restore, delete rows or WAL, modify grants, or upgrade without owner-approved recovery/backup plan.
2. When SQL works, re-audit all six protected tables: jhadina_spatial_evidence, jhadina_spatial_reality_candidates, jhadina_spatial_reality_admissions, jhadina_spatial_workspace_revisions, jhadina_knowledge_nodes and jhadina_knowledge_relations. Check RLS and direct anon/authenticated denial, service-role SELECT/INSERT, and absence of unintended UPDATE/DELETE.
3. Validate other shared Swlc applications before any infrastructure changes. Independently certify Vercel production OIDC identity and exact owner-authenticated JSON output.
4. After explicit owner authorization, run one real non-synthetic USGS canary and independently read back hashed evidence, candidate and admission. Then run real restart/outage/identity/tamper drills without jeopardizing the restored database.

## No false PASS

The eight-stage ledger always returns productionCertified=false. All externally supplied evidence ready means READY_FOR_INDEPENDENT_REVIEW only. Final production certification requires an independent reviewer, same-deployment real receipts and owner signoff.

No production SQL write, schema migration, platform restore, provider purchase, paid upgrade or live canary has been performed in this sequence.
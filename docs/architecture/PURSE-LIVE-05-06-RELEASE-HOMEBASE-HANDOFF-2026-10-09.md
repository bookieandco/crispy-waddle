# PURSE-LIVE.05-.06 — reviewed release and no-Supabase Homebase evidence

Objective: commission the real-money Purse source without bypassing Money Core approvals or relabeling SHADOW paper output as spendable cash. SWLC Supabase #1110 remains AUDIT/REPAIR.

## Verified state at preparation (2026-10-09)
- GitHub main 9eaafe85395e85cea779946fca5672a3d413a102; Vercel last READY production SHA matched main, not this branch. READY build does not establish production durable Memory.
- Six stacked PRs #1162 -> #1166 -> #1186 -> #1188 -> #1190 -> #1191 passed relevant source CI at heads, but NONE recorded an independent APPROVED review. #1162 was moved from draft to ready-for-review; NO PR was merged.
- Combined branch diverged from main, with 181 commits behind at inspection. A clean mergeability status does not replace independent review of capital or execution-adjacent changes.
- SWLC Postgres 57P03 remains blocked after prior full-disk WAL/crash recovery; no migrations, login, real Purse custody, live mandate or history restoration claimed.
- Railway had only unrelated OverageOS and PupsonStuff projects, not an available Purse host; do not modify them. iPhone stays control surface, not persistent runtime.

## .05: GitHub exact-head release review
- scripts/purse-live-05-06-readiness.py performs read-only GitHub API queries, validating six PRs merged into main, non-draft, independent exact-head review, and required exact-head Money/Web/Launch/Postgres CI.
- It compares operator-requested main SHA against actual current GitHub main and checks private Homebase evidence receipt shapes. It only returns BLOCKED or INDEPENDENT_OPERATIONS_REVIEW_REQUIRED: never a trading permit, investment certification or authorization.
- Run: python3 scripts/purse-live-05-06-readiness.py --expected-main "$(git rev-parse origin/main)"
- Expected now: exit 2, BLOCKED, because PRs and real host are not commissioned.
- Reviewed merge order: #1162 -> #1166 -> #1186 -> #1188 -> #1190 -> #1191 -> this PR. After each parent merges, rebase/retarget child to main, recheck diff and approvals, require CI at exact final head and merge only with an expected SHA. No automated bypass for draft/approvals.

## .06: existing owner-controlled Homebase and encrypted Google Drive (NO new host invented)
Run only on an EXISTING approved private host, never on phone/GitHub runners. Configure a preexisting dedicated persistent mount with private permissions and approved disk space.

1. Host reboot proof, using existing scripts (do not reboot automatically):
    python3 scripts/money-portable-host-durable-check.py initialize --root /YOUR-PERSISTENT-MOUNT --head "$(git rev-parse origin/main)"
    # Operator physically reboots the approved host
    python3 scripts/money-portable-host-durable-check.py verify-after-reboot --root /YOUR-PERSISTENT-MOUNT --head "$(git rev-parse origin/main)"
   Capture the second output as host.json. A same-boot result must fail.

2. On that same host, use already-provided portable PostgreSQL 17 with the actual Money schema and a server-only secret PURSE_LIVE_DATABASE_URL. Read-only check:
    pnpm --filter @jhadina/money-core purse-live:storage-probe
   Save to database.json. READABLE_BUT_UNCERTIFIED is only query/schema evidence; independently verify persistence and restore.

3. Reuse existing restic/rclone Drive backups, never raw unencrypted pg_dump uploads:
    python3 infrastructure/homebase/google-drive/backup.py doctor
    python3 infrastructure/homebase/google-drive/backup.py backup-db
    python3 infrastructure/homebase/google-drive/restore_drill.py --receipt /PRIVATE/ACTUAL-BACKUP-RECEIPT.json
   Machine Google OAuth, scoped approved backup folder and RESTIC_PASSWORD_FILE are required. restore_drill demands JHADINA_RESTORE_TRUST_DOMAIN=OWNER_CONTROLLED and JHADINA_RESTORE_APPROVED=YES deliberately configured by operator. Backup result -> backup.json, restore result -> restore.json.

4. Independently verify exact production SHA AND real separate OIDC portable Memory gateway, not just Vercel READY:
    python3 scripts/money-portable-production-probe.py --web-origin https://YOUR-APP --gateway-origin https://YOUR-PRIVATE-GATEWAY --expected-head "$(git rev-parse origin/main)"
   Save web.json. A missing gateway correctly blocks release.

5. Store host.json, database.json, backup.json, restore.json and web.json on a private host, NEVER in Git:
    python3 scripts/purse-live-05-06-readiness.py --expected-main "$(git rev-parse origin/main)" --receipt-dir /PRIVATE/PURSE-RECEIPTS

## Remaining independent external proof
- The encrypted PostgreSQL snapshot restore only proves database-format restoration with nonzero application tables, NOT exact financial row parity, owner balances, money/market providers or original SHADOW history.
- Prior SWLC bytes must be preserved, not overwritten. Recovery project #1110 tracks Supabase disk expansion/platform repair. No paid capacity is authorized here.
- No provider signing, real deposits/withdrawals, execution, live mandates or payouts are activated. PURSE-LIVE.07-.10 remains separate, owner-approved, provider-evidence-backed work.
- The release preflight never issues live authority: canExecute=false, canMoveMoney=false, canAuthorizeLive=false, liveAutonomousTradingCertified=false.

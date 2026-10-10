# MUSIC-SECURITY.21–.25 — RLS / authorized audio intake

**Base:** PR #1198 (`feat/music-live-16-20-20261009`), stacked after #1195 → #1196 → #1197. This tranche is source-only and remains in draft pending CI plus real database release gates.

## Critical discovery
The canonical `packages/music-core/sql/001_music_core.sql` creates nine user-scoped tables with a `user_id` text column, but **does not enable RLS**. Adding authenticated API endpoints without a real RLS policy is not sufficient tenant protection. Direct Supabase SWLC table access currently fails with SQLSTATE `57P03`; existing GitHub incident **#1110** records disk exhaustion (`53100`) and the owner cost decision. **No database change was applied** during this work.

## Implemented
- **.21** `packages/music-core/sql/MUSIC-SECURITY-ADMISSION-2026-10-09.sql` — reviewed-only grant, nine-table owner RLS, no anonymous privileges, and user imports restricted to unauthorized catalog sources. Authenticated clients cannot write admitted `music_assets` records; independently controlled/privileged ingest is required.
- **.22** `packages/music-core/sql/MUSIC-STORAGE-ADMISSION-2026-10-09.sql` — reviewed-only checkpoint grants and private `music-owned` owner-folder Storage policy. Prevent ordinary user UPDATE/DELETE policies for admitted objects. Does not create the bucket or trigger paid storage.
- **.23** `music-security-policy.test.ts` guards baseline policy source invariants. These are **not** a substitute for real Postgres policy evaluation.
- **.24** Signed upload-ticket API `/api/music/owned/upload-ticket`, a pure input validator with tests, and a phone-friendly file picker. Only authenticated users can obtain a random own-folder path. The owner attests private-upload permission; every uploaded file remains **pending separate provenance and playback-rights review**. No asset grant, synthetic provider playback, or public publishing.
- **.25** `MUSIC-SECURITY-PREFLIGHT-READONLY.sql` inventories actual RLS state, existing policies, bucket configuration and table grants prior to operator-approved changes.

## Known risks/gates
1. The two admission scripts are **not migrations yet** and have not run. Once SWLC is recovered, use the supported Supabase migration workflow, review existing policy names and transactional side effects, and *then* commission them.
2. PostgreSQL policies are permissive by default and compose with OR. Unexpected older grants/policies **must be reconciled**; do not assume the new policies override insecure older ones.
3. SQL privileges for `authenticated` are database-wide. Every write policy still checks `auth.uid()::text`; make sure `anon` has no table access.
4. No automatic playback grant from an uploader checkbox or MIME filename. Privileged operator checks ownership/license, actual file type/content, malware, object provenance, correct user ID and playback terms *before* adding a permanent approved source + asset.
5. `createSignedUploadUrl` produces a provider token valid for up to two hours. Keep it ephemeral; do not store/log it. Check private bucket size/MIME limits and restrict object creation to random owner prefixes.
6. The browser upload is a conventional signed-upload request, not a resilient TUS uploader. Network interruptions and large files may require future resumable upload UX. Up to 50 MB is an app-level ceiling, not proof that Supabase bucket accepts 50 MB.
7. Physical iPhone, authenticated two-user PostgREST/storage isolation, real owned playable bytes, signed URL renewal, provider credentials and database restore remain **uncertified**. Mark environment unhealthy until actual receipts exist.

## Operator activation order
1. Resolve SWLC disk exhaustion with owner-approved capacity/recovery; confirm actual writable Postgres without WAL destructive actions.
2. Run only `MUSIC-SECURITY-PREFLIGHT-READONLY.sql`, enumerate unexpected policies/grants and assess rollback/backup.
3. Install a private `music-owned` bucket with explicit content constraints and no public access.
4. Reconcile the canonical migration and apply the two reviewed RLS/storage scripts using controlled migration history.
5. Test two real sessions: owner A cannot read B, cannot create `authorized=true` sources or approved asset records; unauthenticated access fails; storage path spoofing and overwrite fail.
6. Sign one allowed upload, verify exact object bytes, review rights separately, then commission a privileged audio asset, execute actual playback/renewal on phone and retain receipts.
7. Pass full-stack exact-head GitHub CI, then review the stacked merge sequence. Do not infer production certification from green CI alone.

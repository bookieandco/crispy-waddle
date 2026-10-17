# FB-IMPORT.05 → FINAL — bounded source closeout / commissioning hold

Date: 2026-10-17
Repository: bookieandco/crispy-waddle
PR: #1351
Branch: feat/jhadina-facebook-owner-style-import-20261017
State: implementation extended; keep DRAFT and unmerged until release evidence exists.

## Goal
Provide an owner-controlled local Facebook export importer that helps Jhadina adapt to the owner's **reviewed writing preferences** through canonical Memory, without mistaking the owner's profile for Jhadina's independent PersonalityState.

## .05 — Memory lifecycle and isolation
- Owner-reviewed note remains a PENDING Memory candidate until explicit owner approval.
- Existing verified per-request Supabase identity and canonical MemoryRepository are reused; no duplicate schema or process-local production fallback.
- Added route integration regressions for same-origin enforcement, x-user-id spoof resistance, explicit consent and input bounds, same-owner pending retry, approved deduplication, second-owner isolation, and fail-closed unavailable storage.
- Existing approved Memory page now exposes explicit Correct and Forget controls using canonical /api/memory/correct and /api/memory/forget routes. The UI correctly notes that forgetting ends **active recall**, while audit lineage may retain historical content.
- New source test verifies approved -> corrected -> retired -> absent from fresh Context reads, cross-user correction denial and cross-user read exclusion.
- Existing runtime's Memory tables use RLS and revoked anon/authenticated access, with server-side service-role writes; this is source design, not evidence of current deployed DB grants.

## .06 — bounded all-time / iPhone preparation
- ZIP64 end-of-central-directory and ZIP64 per-entry metadata can be parsed under strict metadata/entry bounds; rejects multi-disk, corrupt, overflowing and unsupported entries.
- Decompression remains locally bounded, never uploads ZIP or Messenger. Unsupported iOS compression is shown as an error, not secretly routed to a backend.
- Owners can choose up to six ZIP/JSON export parts at once. Samples are deduplicated and represent multiple years using deterministic round-robin year selection.
- Same safety budget remains: up to 8 MiB per supported JSON entry, 32 MiB JSON budget per archive, 80 eligible JSON files per ZIP, and 2,500 extracted samples per archive / combined preview. Truncation must be identified; no claim that one preview equals all-time import.
- Retained the local-only, transparent writing-cue review; approved summary remains limited to 900 characters.

## FINAL — certification / external holds
Source code is **not** a completed production personality-learning system. The archive preview measures surface writing cues, while qualitative humor/cultural reasoning and stable owner preference Pattern admission require a separately governed provenance model, owner acceptance and explicit non-sensitive semantics. Raw Facebook contents never write Jhadina's independent PersonalityState.

The owner described the one-year Google Drive file as "facebook-avebookie-2026-10-17-from just last year", with an all-time export still preparing. The connected Google Drive search currently returns no accessible match for facebook or avebookie. Do not fabricate archive shape, item counts, style findings, or supported photo/message ingestion.

The connected Supabase project "Swlc" reports ACTIVE_HEALTHY in metadata, but table/migration reads returned Postgres 57P03 (database not accepting connections). Mark **SWLC / Supabase: AUDIT/REPAIR REQUIRED**, not "operational." No production DB changes or user data writes performed.

### Proof that still requires external state
1. All exact-PR-head CI jobs actually pass: type-check, lint, tests, Next production build, Personality/JLLM/UX/launch, web conformance and any mandatory tests.
2. Inspect the owner's one-year export through authenticated Google Drive metadata and private bounded parsing; ensure **no private content is placed in the public repo, PR logs, test fixtures or public Vercel build artifacts**.
3. Verify deployed app's version and authenticated owner/second-account isolation against commissioned durable storage, schema/grants and two-user RLS evidence. A service-role policy in a source migration alone is not enough.
4. Real iPhone Safari user test: file picker, ZIP/JSON/ZIP64, decompression or graceful fallback, cancellation, local preview, approval, correction, forget, and next-session memory recall. Preserve notes on retention limitations.
5. End-to-end encrypted backup/restore and reimport compatibility, including all-time export's real size, separate date ranges and any portability requirements.
6. Only then review/merge and commission this feature. Do not enable automated Facebook scraping, credentials, external publication or inference costs.

### Source test commands
pnpm --filter @jhadina/jhadina-web type-check
pnpm --filter @jhadina/jhadina-web lint
pnpm --filter @jhadina/jhadina-web test -- src/lib/personality/facebook-owner-import.test.ts src/lib/personality/facebook-owner-signals.test.ts src/lib/personality/facebook-owner-context-bridge.test.ts src/app/api/personality/facebook/propose/route.test.ts
pnpm --filter @jhadina/jhadina-web build

### Owner test path once deployed
Jhadina > Memory > Import your Facebook writing > Choose file(s) > Review cues and redact/edit summary > Propose memory > Approval Center > Approve > Memory > Correct / Forget.

### Release decision
Source progression .05/.06 has been committed. FINAL is **BLOCKED / NOT COMMISSIONED** until the five externally verifiable evidence groups above are satisfied. Preserve completed work; do not claim a live launch from green source-only CI.

# JH-FACEBOOK-OWNER-IMPORT.02–.05 — source continuation handoff

Date: 2026-10-17
Status: **SOURCE IMPLEMENTED / CI AND LIVE ACCEPTANCE PENDING**
Initial implementation: PR #1351 (draft)
Continuation: PR #1352 (draft, stacked on #1351)
Identity: authenticated session-bound Supabase claims; the browser's x-user-id is a consistency assertion, not a credential.

## Work completed on branch

### .02 — archive reader and preview
- Preserved the conservative file allowlist: self-authored posts and comments JSON only, not Messenger/friends/security/photos.
- Bounded classic ZIP entry size, total bytes, number of files, and sample count. Reject ZIP64/encrypted archives, unreadable directories, oversized JSON.
- Added file-level progress/cancellation with AbortSignal and a local Cancel control. Corrupt supported JSON becomes a visibly partial preview, not fabricated evidence.
- JavaScript remains in the browser; raw ZIP/JSON and excerpts are not sent to the API.
- Browser-based DecompressionStream('deflate-raw') compatibility on real iPhone Safari is **not certified**; JSON direct-file upload remains the fallback.

### .03 — opt-in writing observations
- Added deterministic, qualitative indicators for question-led interaction, storytelling setup, contrast/reversal, expressive punctuation and concise writing.
- Require at least eight distinct local samples before proposing any signal; require repeated matches and minimum share. These are **weak writing observations**, not psychological/personality truth.
- Owners choose signal IDs, inspect their own local samples, and edit the final note. Nothing is auto-approved.
- Never infer protected traits, pathology, politics, demographics or personal identity from source text.
- No sampled post or comment, face/friend data, album, private messages, tokens, or media goes to model or server.

### .04 — bounded authorized Memory pathway
- No second PersonalityState, PatternPort, ValuesCore or permission schema was created.
- Owner-selected note is stored only as a PENDING CONTEXT candidate in canonical ReasoningEventRepository/MemoryRepository.
- Existing explicit Memory Approval Center is still required. After approval, existing Context Builder can retrieve relevant owner text by authenticated user and query relevance.
- Jhadina's independent PersonalityState remains unchanged. User communication preferences and Jhadina's own personality are distinct.
- Added a regression that proves pending and wrong-owner notes are not present in context, approved notes are, and forgotten notes disappear.

### .05 — privacy, tenancy and lifecycle
- Strict API payload schema rejects unexpected raw-archive fields, requires reviewed note and valid source count/signal IDs, and checks basic secret-key patterns.
- Existing Supabase session-derived identity and same-origin request guard retained; production never falls back to unverified in-memory storage.
- Owner-scoped best-effort duplicate suppression for same pending or already-approved notes. **Not concurrency-atomic**; unique transactional storage key remains an external hardening item.
- Fixed Context Builder to admit approval timeline evidence only if the matching owner memory remains APPROVED. Historical audit timeline is not deleted, but forgotten/corrected notes must no longer resurface as current knowledge.
- Tests cover consent, source restrictions, cross-owner negative access, candidate lifecycle, duplicate retries, storage failure and revoked memory knowledge suppression.

## Outstanding external and operator gates — AUDIT / REPAIR
1. **Supabase/storage**: validate actual deployed provider, migrations, authenticated owner+second-owner RLS, persistence across restart, encrypted off-host backup/restore and forget/correction retention semantics. No production DB change here.
2. **Real owner Facebook export**: schema/size/ZIP64 compatibility and permission boundaries using synthetic data first; then review owner-selected sample on device without saving archive to GitHub.
3. **iPhone Safari**: prove ZIP inflation availability, browser memory ceilings, cancellable progress, state clearance after refresh and PWA operation; supported JSON fallback required.
4. **Exact-head CI**: verify PR #1352 effective head, targeted Vitest and type-check, lint, production Next build and appropriate broader context/personality workflows. Earlier PR #1351 CI had two JSX apostrophe lint errors; fixed in continuation.
5. **Concurrent dedup**: database-level atomic idempotency key and migration/RLS tests before claims of exactly-once submission.
6. **Live owner personalization canary**: owner approves a benign style note, Jhadina reads only that approved note as context, correct/forget stops its use. Run separate account isolation and verify no raw samples were transmitted.

## Ordered follow-through
- Finish exact-head CI; repair any regressions, reconcile PR #1351 and #1352 without overwriting newer main.
- Merge #1351 first after its own checks, then retarget/merge #1352 after refreshed exact-head checks.
- Continue JH-FACEBOOK-OWNER-IMPORT.06–.08: actual user-controlled import to approved memory use, real iPhone acceptance, storage and second-user isolation, explicit owner consent and observed reply quality.
- Keep inactive in production until those external gates pass. Do not ask for a real personal archive yet.

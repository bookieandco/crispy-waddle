# JH-FACEBOOK-OWNER-IMPORT.01 — Facebook writing preview / reviewed owner memory proposal

Date: 2026-10-17
Base: main at c58a3e833219a24563bde6dcfb5f81c2e6bd0f0a
Branch: feat/jhadina-facebook-owner-style-import-20261017
Status: SOURCE IMPLEMENTATION — exact-head CI, signed-in browser, real export and deployment proof pending.

## Purpose

The owner wants to import a personally exported Facebook history so Jhadina can better understand their communication, humor, interests and cultural voice. This is **information about the owner**, not a new source of authority over Jhadina's PersonalityState. Preserve the existing Experience → governed Memory → eligible Pattern → Personality pipeline.

## Implemented in .01

- /memory links to /memory/facebook.
- Owner can pick JSON or ZIP from an iPhone/desktop file picker without using a Facebook password or API token.
- Browser reads only allowlisted self-written post/comment JSON files and skips Messenger, reactions, friends, group data, photos/media, ads, login/security files and all unrelated archive contents.
- ZIP parsing reads the central directory and bounded JSON entry slices; it does not unpack files to disk or decompress media. ZIP64 and encrypted entries fail closed; size, entry, count and sample caps protect the browser.
- Preview shows excerpts locally. A deterministic, modest statistics-based writing note can be edited by its owner; **no psychological, protected-trait or clinical inference is performed**.
- Owner must explicitly review, then propose an edited short note. Only the note and source count go to the authenticated, same-origin server route.
- Server reuses canonical ReasoningEventRepository and MemoryRepository, creates a pending CONTEXT memory candidate, and does **not** approve or project PersonalityState.
- No Facebook scraping, OAuth, app tokens, data publication, media hosting or raw archive storage.

## Limits and unfinished acceptance

- This is not yet a comprehensive personality-learning engine. Averages, emoji and punctuation frequencies are observational and are not claims about inner motives, sensitive identity or reliable stable traits.
- Facebook exports vary by product, locale and date. Current JSON path/field allowlist is intentionally narrow and may miss valid files rather than risk including other people's private content.
- Browser memory and WebKit constraints must be tested with a real, owner-controlled export. The import supports only bounded classic ZIP archives; ZIP64 and oversized JSON need a future scalable, privacy-reviewed design.
- Archive contents never enter a model at this stage. Approved notes may inform the existing owner Memory context, but real governed Pattern admission/semantic profiling needs a separately reviewed source-provenance integration.
- Private posts may still mention third parties; the owner must review the draft before proposing. Imported text is untrusted content, never tool instructions or permission.
- Existing SWLC/Supabase authenticated storage and restore blockers remain independent and may prevent proposal persistence; do not fall back to unscoped or process-local memory.
- The public repository must never receive personal archives, sample fixture excerpts from the owner, access tokens or credentials.
- This branch does not deploy, approve memory, train a model, alter voice, scrape Facebook or commission live services.

## Focused source checks

pnpm --filter @jhadina/jhadina-web type-check
pnpm --filter @jhadina/jhadina-web test -- src/lib/personality/facebook-owner-import.test.ts
pnpm --filter @jhadina/jhadina-web lint

Check those commands against the exact PR head and verify all jobs actually ran, not merely a green aggregated status.

## Next ordered coding sequence

1. JH-FACEBOOK-OWNER-IMPORT.02 — file fixture compatibility (modern/legacy Facebook shapes), ZIP directory edge cases, import progress/cancellation, iPhone memory/size profiling.
2. JH-FACEBOOK-OWNER-IMPORT.03 — owner-approved, provenance-linked qualitative signal proposals (humor mechanisms, preferred speech cadence, interests) with confidence, evidence, contradictions and no sensitive-protected inferences.
3. JH-FACEBOOK-OWNER-IMPORT.04 — exact canonical approved Memory → eligible Pattern bridge; user preference signals must **not** overwrite Jhadina's own personality, values, safety, autonomy or authorization.
4. JH-FACEBOOK-OWNER-IMPORT.05 — authenticated owner/second-account isolation, RLS, correction/forget/reimport dedupe, encrypted backups and restore proof on commissioned storage.
5. JH-FACEBOOK-OWNER-IMPORT.LIVE — real iPhone with owner-created export, consent/review, pending→approval→actual downstream context read verified via observable output, negative cases and human acceptance before calling this complete.

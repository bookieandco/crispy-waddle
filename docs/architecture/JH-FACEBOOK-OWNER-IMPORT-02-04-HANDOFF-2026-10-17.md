# JH-FACEBOOK-OWNER-IMPORT.02–.04 — Source continuation and real-export blocker

Date: 2026-10-17
PR: #1351
Branch: feat/jhadina-facebook-owner-style-import-20261017
Status: SOURCE PATCHED; CI and human/device/data-plane proof pending. Not commissioned.

## Scope and source work performed

### .02 — parser and browser acceptance hardening
- Preserved the original browser-only, positive-allowlist importer and explicit bans on Messenger/inbox, friends, security, reactions, ads, groups and media.
- Added authored legacy \`status_updates\` extraction and common posts/comments collection envelopes. Generic attachments, titles, and thread messages are never translated into owner-authored writing.
- Validated ZIP multi-disk declarations, compressed method consistency, local filename parity, size and file count limits. Unsupported/invalid matching JSON entries report a partial import rather than misrepresenting coverage.
- Added AbortSignal cancellation, guarded stale async completion, progress callbacks, local iPhone progress UI, and additional synthetic safety fixtures.
- ZIP64, encrypted archives, unsupported compression and larger-than-cap files remain unsupported; these fail closed or are marked partial. Real-world Facebook export schema variation is not proven.

### .03 — owner writing cues, not clinical or identity inference
- Added a deterministic client-only observation module measuring questions, laughter markers, expressive punctuation, emoji and lengths.
- Local evidence is counted per entry and points to local preview indexes; no raw post, contact information or excerpt is sent or committed.
- Observations require a 10-entry denominator and at least 3 matching entries. Confidence labels describe corpus coverage only; they are not psychological certainty.
- Cues are explicitly presented as tentative observations and can be deselected and edited before an owner consents.
- This is a bounded first-pass corpus profile, not model training, humor comprehension, cultural-identity inference or verified personality diagnosis. Future semantic work requires explicit protected-trait exclusions, source provenance and owner acceptance.

### .04 — canonical approval bridge, no unauthorized personality projection
- Only the owner-reviewed <=900-character summary and owner-reported source count cross the API.
- API verifies signed-in identity, same-origin JSON, bounded payload and consent, and reuses canonical ReasoningEventRepository and MemoryRepository.
- Pending/rejected summaries are absent from approved Memory Context; approved summaries can appear in that account's normal Context Builder. Cross-account isolation and unchanged Jhadina PersonalityState have source tests.
- Added best-effort same-owner duplicate checks for pending and approved notes. Concurrency-proof persistent idempotency is not yet established.
- **No raw archive, unsanctioned trait, unapproved writing cue or third-party information is promoted into immutable Pattern/Personality evidence.**
- Existing governed Pattern eligibility, Jhadina's independent personality, Values Core, Identity Core and Safety remain untouched. Owner-profile semantic attribution into immutable Pattern lineage is a further separately gated integration; source note/context acceptance is not proof of this.

## Real export / Drive fixture status

The user identified a one-year test archive in Google Drive named
\`facebook-avebookie-2026-10-17-from just last year\`, with an all-time export forthcoming.

Authenticated Drive discovery searches for \`facebook-avebookie-2026-10-17\`, \`avebookie\`, \`facebook\`, \`zip\` and an unfiltered recent-file browse did **not** return that archive in the accessible account. Therefore:
- Not downloaded or inspected; no assumptions about its format, size, number of posts or contents.
- No private Facebook data has been placed in GitHub, tests, PR logs or CI fixtures.
- Synthetic fixture unit tests are present but are not a substitute for real export validation.
- The all-time file is not yet available and must not be claimed tested.

## Verification commands at current PR head

\`\`\`sh
pnpm --filter @jhadina/jhadina-web type-check
pnpm --filter @jhadina/jhadina-web test -- src/lib/personality/facebook-owner-import.test.ts src/lib/personality/facebook-owner-signals.test.ts src/lib/personality/facebook-owner-context-bridge.test.ts
pnpm --filter @jhadina/jhadina-web lint
pnpm --filter @jhadina/jhadina-web build
\`\`\`

Also verify exact-head all-target CI (launch, personality, web deploy, UX, JLLM) and inspect the actual job conclusions. Earlier head \`6a064fad...\` failed due to two JSX apostrophe lint violations, repaired in subsequent commit \`5ef1abe8...\`; its green successors cannot be inferred from those repairs alone.

## Pending before merge/live

1. Exact-head lint, tests, type-check, production build all green; browser ZIP parsing checked in actual iOS Safari with a non-private synthetic fixture.
2. Access the specifically named one-year Drive export and inspect its archive metadata privately, without publishing content. Adapt file recognition from observed safe schemas and verify the allowed authored-post/comment count.
3. Authenticated database/signed-in second-account, RLS and retention/forget acceptance, including worker/gateway/Supabase recovery if relevant; no fallback to process-local production memory.
4. Owner manually reviews a real one-year preview, submits an edited note, approves it, and verifies next-session context read. Test correction/revocation/reimport and backups.
5. Only then benchmark all-time export, its ZIP64/size variability and distributed date coverage. Do not assume all-time import complete from a truncated preview.
6. Semantic personality learning beyond descriptive writing metrics requires separate reviewed, immutable evidence lineage and explicit owner preference semantics; never mutate Jhadina's own state based on Facebook data.

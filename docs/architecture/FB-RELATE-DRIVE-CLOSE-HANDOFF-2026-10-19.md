# FB-RELATE — October 19 Drive Corpus Reconciliation & Closeout Handoff

**Status:** evidence and ordered coding plan; Supabase, durable Memory, public launch and external effects explicitly **deferred**. Existing draft [PR #1351](https://github.com/bookieandco/crispy-waddle/pull/1351) stays unmerged. This document contains **only source metadata and numeric aggregate counts**, never Facebook writing, account secrets, media, source file contents or message bodies.

## 1. Sources checked (owner-scoped)

### Yesterday: October 18
- Original Google Drive Facebook export is an **application/zip** of exactly **680,688,714 bytes**, still present separately.
- Owner's real iPhone Safari result: `FB-IMPORT-LOCAL-COUNTS-v1`, **3 eligible JSON files read / 0 skipped**, **2,500 bounded writing samples** over **2010–2026**, **1,400 posts + 1,100 comments**.
- `partialPreview=true`, `completeHistoryVerified=false`. It is a sample distribution, not exhaustive Facebook activity.
- The repaired ZIP parser handles a nonstandard EOCD and local-offset bias. Real-user Safari proved ZIP preview, **not entire archive equivalence**, nor durable memory approval.

### Today: October 19
- A **Drive folder**, not a 2.1 GB ZIP file, named `facebook-avebookie-2026-10-19-f5PI3j4d` was located. Its root contains `your_facebook_activity` with posts, comments/reactions, stories, reels, groups, media and other areas.
- **Total extracted folder size is NOT verified**; user's description of 2.1 GB is plausible but not independently established from metadata. Media likely explains much of the larger uncompressed footprint, but this is not proven.
- Examined only three explicitly allowlisted, non-Messenger owner-writing JSON files in that extracted folder. All content was parsed privately for **aggregate counters only**; no raw writing was copied to this handoff, PR, tests or answer:

| Eligible owner-writing file | Bytes | Raw JSON entries | Recognized owner-text entries |
|---|---:|---:|---:|
| `posts/your_posts__check_ins__photos_and_videos_1.json` | 3,771,648 | 10,000 | 7,330 |
| `posts/your_posts__check_ins__photos_and_videos_2.json` | 1,456,669 | 2,758 | 1,991 |
| `comments_and_reactions/comments.json` | 2,721,031 | 8,303 | 7,129 |
| **Total** | **7,949,348** | **21,061** | **16,450** |

- Thus **9,321 recognized posts** and **7,129 recognized comments**. Across those records, normalized `(kind, lowercased text)` produced **13,423 distinct strings** and **3,027 repeated-string occurrences**. This is a textual dedup statistic, **not proof of duplicates/corruption**; identical wording can appear legitimately in different posts/dates.
- All three selected files are below the current **8 MiB per-JSON file** limit, and the combined 7,949,348 bytes is below the **32 MiB aggregate JSON** limit. Existing Safari native Files picker accepts **up to six ZIP/JSON files**. This avoids processing the full media-heavy folder.
- Do **not** inspect/ingest Messenger, friends, ads, security/login, photos/video media, reactions/likes, unrelated third-party posts or groups as part of this feature. `posts_on_other_pages_and_profiles.json` is deliberately excluded until authorship/scope is proven.

### Numeric observed year × type census from today's three allowlisted JSON files

**Observed entries in the processed JSON only; NOT all-time Facebook totals or globally unique posts.**

| Year | Recognized posts | Recognized comments | Recognized total | Yesterday's sampled total |
|---|---:|---:|---:|---:|
| 2010 | 41 | 105 | 146 | 30 |
| 2011 | 829 | 591 | 1,420 | 158 |
| 2012 | 793 | 566 | 1,359 | 220 |
| 2013 | 1,879 | 962 | 2,841 | 516 |
| 2014 | 1,189 | 396 | 1,585 | 227 |
| 2015 | 1,017 | 375 | 1,392 | 166 |
| 2016 | 875 | 505 | 1,380 | 174 |
| 2017 | 359 | 349 | 708 | 100 |
| 2018 | 343 | 466 | 809 | 139 |
| 2019 | 385 | 467 | 852 | 124 |
| 2020 | 408 | 498 | 906 | 163 |
| 2021 | 273 | 283 | 556 | 81 |
| 2022 | 57 | 53 | 110 | 12 |
| 2023 | 83 | 416 | 499 | 84 |
| 2024 | 39 | 205 | 244 | 38 |
| 2025 | 664 | 887 | 1,551 | 252 |
| 2026 | 87 | 5 | 92 | 16 |
| **Total** | **9,321** | **7,129** | **16,450** | **2,500** |

**Match finding:** both yesterday and today involve **three eligible owner-writing JSON files** and **all the same 17 represented years**. Every old sampled year total is less than or equal to today's recognized total. This is **consistent with** today's folder being an extracted or newer copy of the same historical corpus, but does **not** prove binary identity, complete export parity, identical record sets or account start date. Comparing 16,450 vs 2,500 as if they were the same counting method is invalid.

## 2. Verified code and outstanding gates

- Draft/open/unmerged PR #1351 head **`7ad747774faa584bb63acf022f52afc35f57b1f4`** currently passes **17/17 exact-head GitHub workflow checks**, no failures. Recheck HEAD/CI before later changes.
- Live owner-protected Vercel preview from October 18 supports local ZIP import, bounded census, owner keep/reject/edit cue cards and local review receipt. Its real iPhone **coverage-v2 and cue-review acceptance remain pending**, regardless of source CI.
- PR diverges from current main (**138 commits ahead, 200 behind** at 2026-10-19 comparison). Selective reconciliation is mandatory; no blind merge or branch overwrite.
- `FB-RELATE.COVERAGE.01–.04` and `FB-RELATE.APPROVAL.05–.08` are implemented in source, not owner-runtime-certified or fully integrated with durable Memory.
- Canonical owner pending-proposal route exists but depends on verified owner authentication and durable storage; **Supabase and runtime Memory persistence intentionally remain later-phase HOLD**.

## 3. Ordered coding sequence — FB-RELATE.DRIVE-CLOSE.09 → .16

### .09 — Explicit corpus manifest and source acceptance
- Define a schema-versioned **metadata-only** manifest with `sourceKind: extracted-drive-folder | zip | selected-json`, selected JSON counts/sizes, recognized-year ranges and completeness flags. Do not store Drive file IDs, tokens, profile identifiers or raw text.
- Mark today's three eligible JSON files as an **owner-selected test fixture scope**, not automatic Drive folder sync.
- Regression: all three within existing limits, no Messenger/media inclusion; if selected file exceeds a limit, show precise local corrective action, never silently trim.

### .10 — Direct three-JSON iPhone path (fastest working route)
- Retain the existing iOS native multiple-file picker. Add **Use extracted Facebook JSON files** help text, guiding the owner to select precisely the two `your_posts__...` JSON files plus `comments.json` from Drive in Files.
- Accept files in any order and maintain total six-input limit. No Google OAuth expansion, raw-content cloud upload, server-side Drive crawl, or full 2.1 GB download.
- Regression: filenames, content allowlist, cancellation, remove/reselect, Google Drive Files provider MIME variation, chunk/memory budget.

### .11 — Census/duplicate provenance report
- Reconcile source code counts against **16,450** observed records (9,321 posts, 7,129 comments) and per-year totals under synthetic fixtures or owner-local numeric acceptance. Distinguish: *raw entries / recognized text occurrences / normalized repeated strings / bounded distinct sample*.
- Never substitute observed counts for account-wide totals or infer unsupported years/content are absent.
- Report skipped inputs, selected-file count, coverage limits, parser version, corpus warning flags. Keep any text fingerprints local; don't print post excerpts into logs or GitHub.

### .12 — Balance, dedupe and style signal review
- Validate year×post/comment sampling under heavily imbalanced synthetic data; ensure 2010/2011/2022 and sparse 2026 comments can remain represented if actually observed.
- Prevent accidental overconfidence from a 2,500-sample ceiling. Dedup repeated normalized text in the **sample**, without erasing valid distinct dated entries from observed census.
- Keep writing-style cues descriptive, reviewable and non-sensitive; do not infer clinical, political, religious or identity traits.

### .13 — Owner-only review and no-write approval flow
- Retain the owner edit/keep/reject/undecided cards. Editing resets review choice; no candidate selected by default.
- Add an explicit **Review and prepare local note** state, counts-only review receipt, private-copy fallback and clear/reset without leaving stale excerpts.
- Only an independently authenticated owner with explicit note-level opt-in can later use the canonical pending-Memory route. **Do not test or trigger that write while Supabase is deferred**.

### .14 — Security and adversarial regression
- Source tests for ineligible messages, third-party content, corrupt/oversized JSON and ZIP metadata, archive offset recovery, duplicate text with different dates, cross-file order invariance, same-origin boundaries, no raw archive/upload and no automatic persistence.
- Ensure diagnostics only report fixed codes/numbers, not browser-provider paths or raw errors. Memory limits remain strict.

### .15 — Real iPhone Safari acceptance, read-only
- Privately deploy an exact-head preview with project-level deployment protection confirmed. Owner selects today's **three JSON files** in Files, not the media folder. No public/production cutover.
- Owner copies **`FB-IMPORT-LOCAL-COUNTS-v2`**; expected numeric reference is **16,450 recognized** over 2010–2026, with caveat that parser/version interpretation must be compared before treating a mismatch as an error.
- Verify allowlisted files read/skipped, sample cap, memory consumption, graceful cancellation, year/type table, cue keep/edit/reject/reset, counts-only review receipt. **No pending Memory submission**.

### .16 — Current-main reconciliation and scope-limited closeout
- Recompare PR #1351 with **current** main; selectively port only tested importer/census/review changes and resolve security conflicts. Run exact-head type checks, tests, build and independent Vercel preview protection check.
- Close only **client-side extraction + review** after real-device owner evidence. Leave PR draft/unmerged unless separately authorized. Produce a final handoff that clearly separates passing code checks from owner device evidence.
- Defer canonical pending/approved Memory persistence, two-owner RLS, Supabase database recovery, correction/forget/next-conversation retrieval, optional Meta OAuth, live account sync, and runtime personality activation to a **separate authorized phase**.

## 4. Release / privacy holds

**Never** upload raw Facebook archive files, photos, friends, private messages or selected writing text to GitHub or servers; do not publish, spend, scrape a personal profile, use someone else's credentials, disable preview protection, auto-approve/promote Memory, or migrate Supabase/D1 while this stage is active.

**Definition of completion now:** private iPhone file selection and local extraction of today's 3 small JSON files; numeric census aligned with a bounded sample; owner able to keep/reject/edit local notes; receipt contains counts only; exact-head CI and device evidence recorded. This is NOT durable Memory enablement.

**Immediate operator action:** reuse the already READY private Safari importer, open Drive Files and select the 3 writing JSON files; compare resulting safe v2 counts against the manifest here. Code .09–.14 and .16 can be source-only; .15 requires owner iPhone participation. Keep Supabase deferred.

Tracking: PR #1351, #1355 (archive/coverage), #1360 (iPhone); master handoff `docs/architecture/FB-RELATE-MASTER-HANDOFF-2026-10-18.md`.

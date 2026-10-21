# JHADINA FACEBOOK / FB-RELATE — MASTER HANDOFF
**Snapshot:** October 18, 2026 · Current GitHub audit snapshot  
**Status:** Source implemented; protected previews READY; Safari acceptance partially complete; production / durable Memory activation **HOLD**.  
**Owner profile:** https://www.facebook.com/avebookie — personal profile, not a managed Facebook Page.  
**Repository:** \`bookieandco/crispy-waddle\`  
**Draft PR:** https://github.com/bookieandco/crispy-waddle/pull/1351  
**Branch:** \`feat/jhadina-facebook-owner-style-import-20261017\`  
**Verified source head before this report commit:** \`1b3d11fea33d002b6c966caed5ee9e5e57307d60\`  
**Exact-head GitHub CI:** **17/17 passed**, zero failures, at that head.  
**Branch divergence from current \`main\`:** **137 ahead / 198 behind** (compare result from this snapshot). **Do not merge blindly**.  
**Tracking:** [#1355](https://github.com/bookieandco/crispy-waddle/issues/1355) (all-time import/coverage), [#1360](https://github.com/bookieandco/crispy-waddle/issues/1360) (Safari and runtime acceptance).

## 1. Executive decision

Jhadina can locally open and parse the owner's actual 680,688,714-byte Facebook ZIP on iPhone Safari. The **original, real-device \`FB-IMPORT-LOCAL-COUNTS-v1\` report is accepted only as evidence of a bounded sample**. Later source implements \`FB-IMPORT-LOCAL-COUNTS-v2\` coverage denominators and \`FB-RELATE-LOCAL-REVIEW-v1\` owner-selectable review decisions. Both source changes have exact-head CI, but the owner **has not yet confirmed either flow with the real ZIP in the new preview**. No Facebook posts, messages or ZIP data were uploaded to the assistant or a third-party server as part of the import; only owner-copied aggregate counts/diagnostics were shared.

**Hard boundary:** Facebook personal-profile writing is not the same thing as a Meta business Page. Markifact's current Facebook Organic read functions operate on connected managed Pages (currently “Pups on Stuff”), **not on the \`avebookie\` personal timeline**. No personal-profile Facebook OAuth sync exists in this scope. Meta \`user_posts\` approval, if desired, is a separate feasibility project.

## 2. Grounded acceptance evidence

The owner selected a Facebook ZIP via iPhone Safari Files and shared a local, aggregate-only report:

| Evidence | Actual result | Interpretation |
|---|---|---|
| Selected archive size | **680,688,714 bytes** | Matches original Google Drive file metadata; not evidence of semantic completeness |
| ZIP end record | Found at physical file end, classic non-ZIP64 | Original EOCD central offset was inconsistent |
| EOCD central entry count | **8,756** | Metadata file entries, **not** owner writing post count |
| EOCD directory metadata | **1,137,589 bytes** | Original EOCD offset \`2,152,289,679\` was out of bounds |
| Recovered central start | **679,551,103** | Anchored before EOCD and validated by guarded parse |
| Constant displacement | **1,472,738,576 bytes** | Mathematically reconciled for **selected** local JSON entry headers only |
| Files successfully read | **3 eligible JSON**, **0 skipped** | Only eligible allowlisted writing JSON, not all archive files |
| Bounded samples | **2,500 total** = **1,400 posts**, **1,100 comments** | Sampling cap was reached; **not** actual FB lifetime totals |
| Years represented | **2010–2026 (17 years)** | Oldest represented sample is **not** proof of first-ever post/account creation |
| Owner report flags | \`partialPreview=true\`, \`completeHistoryVerified=false\` | Accurate: full history **not established** |

The parser initially produced \`ZIP directory exceeds safety limits\`, then \`ZIP directory points beyond the archive\`; v2 diagnosis reported \`RECOVERED_LOCAL_OFFSETS_INVALID\` at 8,192/8,756 entries scanned. A guarded EOCD directory-offset and unique local-header offset reconciliation fixed the actual Safari import. Do **not** remove signature, count/span, file-size, ambiguity or matching filename/method checks.

## 3. Completed coding milestones

### ZIP access / preview — previous sequence
- iPhone-native 54-pixel Files picker; no restrictive ZIP MIME \`accept\` filter.
- Narrow route-scoped preview exception for \`/memory/facebook\` on the exact import preview branch; Vercel Deployment Protection still enforces private access. **Not** an exemption for backend proposal API, Approval Center, other routes, other branches or production.
- Blob-sliced ZIP central-directory processing (256 KiB windows) with bounded ZIP64 handling, progress/cancellation and selected owner-writing allowlist; never unpack the full 681 MB archive.
- Only safe, uniquely validated positions are considered when central/local offsets are inconsistent. No arbitrary archive scanning, mutation or media extraction.
- Limits retained: 8 MiB per compressed/uncompressed selected JSON, 32 MiB selected JSON per archive, at most 80 eligible files/ZIP, at most 2,500 retained writing samples overall, at most 6 selected exports. \`messages\`, \`friends\`, security, other-party activity, media and similar content remain excluded.

### \`FB-RELATE.COVERAGE.01–.04\` — completed in source
1. **.01 census:** \`parseOwnWritingJsonWithCoverage\` counts recognized writing entries and numeric post/comment counts per year across successfully parsed allowlisted files, separately from the retained samples. Repeated writing can be counted more than once; counts are **not exhaustive FB account totals**.
2. **.02 balanced sampler:** deterministic, bounded sampling by year × writing kind, better rare-year/comment representation and retained-only deduplication. Still capped at 2,500.
3. **.03 Safari UI / audit:** separately labeled observed counts vs sampled counts, skipped/partial warnings, \`FB-IMPORT-LOCAL-COUNTS-v2\` numeric-only copy action and limits. Never displays these as historical absolute totals.
4. **.04 regression/handoff:** synthetic >2,500-entry scans, deterministic balancing, sparse types, incomplete/invalid files, Messenger exclusion, no private text in audit. See \`docs/architecture/FB-RELATE-COVERAGE-01-04-2026-10-18.md\`.

### \`FB-RELATE.APPROVAL.05–.08\` — completed in source
5. **.05 local cue generation:** fixed-language observational cards for question-led phrasing, laughter markers, emphatic punctuation, emoji, short/long writing. All default \`undecided\`. Not psychological conclusions or instructions.
6. **.06 owner review:** independent **Keep in local draft / Reject cue / Undecided** per cue; editable text resets decision to undecided. Selected notes enter an owner-editable draft **only after a deliberate button click**. No auto-generated submitted note.
7. **.07 audit receipt:** \`FB-RELATE-LOCAL-REVIEW-v1\` contains only decision counts and fixed statuses. Its \`memoryWritesByThisReceipt=0\` and \`memoryApprovalStatus=not_verified_by_local_receipt\` assert **only** that the local receipt didn't perform persistence, not that the user's account has no existing pending/approved memories.
8. **.08 tests/handoff:** four synthetic owner-review tests: no raw excerpts, selected/rejected separation, edits, no-write receipts and no automatic approval. See \`docs/architecture/FB-RELATE-APPROVAL-05-08-2026-10-18.md\`.

**Existing API preserved:** \`POST /api/personality/facebook/propose\` accepts only a short, explicitly reviewed owner-authored summary with verified identity, same-origin and bounded fields, then creates a **pending** canonical Memory candidate. This source-only sequence has **not** invoked the API. Final Memory approval is a separate action in \`/approvals\`; no automatic admission or personality activation.

## 4. Key source paths

- \`apps/jhadina-web/src/app/memory/facebook/page.tsx\` — iPhone local picker, coverage tables, review, numeric-only copy actions; do not add ZIP upload.
- \`apps/jhadina-web/src/app/memory/facebook/page.test.tsx\` — static iPhone picker privacy test; live client interactions still need physical acceptance.
- \`apps/jhadina-web/src/lib/personality/facebook-owner-import.ts\` and \`.test.ts\` — ZIP repair, owner allowlist, numeric census, balanced sample, v1/v2 diagnostics, bounded limits.
- \`apps/jhadina-web/src/lib/personality/facebook-owner-signals.ts\` and \`.test.ts\` — descriptive sample-level writing signals.
- \`apps/jhadina-web/src/lib/personality/facebook-owner-approval.ts\` and \`.test.ts\` — local owner keep/reject/edit/copy review receipt.
- \`apps/jhadina-web/src/lib/personality/owner-interaction-preference.ts\` — separate explicitly owner-authored conversation preferences.
- \`apps/jhadina-web/src/app/api/personality/facebook/propose/route.ts\` and \`.test.ts\` — authenticated canonical pending Memory proposal boundary, not yet live-certified.
- \`apps/jhadina-web/src/lib/supabase/middleware.ts\` and \`.test.ts\` — exact preview route exception; all other sensitive routes remain authenticated.
- \`deploy/jhadina-memory-cloudflare/\` — candidate D1 storage implementation; **not evidence production is commissioned**.

## 5. Deployment and CI — carefully separated

| Item | Result | Limit |
|---|---|---|
| Current source head before report | \`1b3d11fea33d002b6c966caed5ee9e5e57307d60\` | **17/17 exact-head GitHub Actions success**; this is not production accreditation |
| Approval-review private preview | \`dpl_53MDEG5zUaDde5HRkuCFD9MTzaf8\` | **READY**, target \`null\`, exact SHA \`1b3d11f\`, Vercel SSO protection enabled |
| Approval-review URL | https://crispy-waddle-jhadina-dwniv4i3f-bookieandcos-projects.vercel.app/memory/facebook | Only for owner-protected Safari acceptance, not public access |
| Coverage-v2 prior preview | \`dpl_9DHkmG6TvNb2TcppJmfmsY2HqKMA\` | READY, exact SHA \`46e55a7\`, 17/17 CI; newer approval preview supersedes it |
| Last proven **real** iPhone archive parse | \`0ab7b4c82256e58cd53117b11b988b45eebd7864\` | Local counts-v1 passed; **does not** prove new counts-v2 or owner-review UI |
| GitHub PR #1351 | DRAFT, OPEN, UNMERGED | At snapshot **137 commits ahead / 198 behind \`main\`**, touching ~38 files. Targeted current-main rebase/cherry-pick reconciliation required |
| Durable runtime / owner approval | **NOT CERTIFIED** | No verified owner-authenticated pending-write, D1/Supabase restore, cross-owner isolation, approved Memory retrieval, reject/delete/forget or next-session consistency |

Do not promote a preview or merge a diverged branch solely because GitHub source CI is green. Re-run **exact new-head** tests after any reconciliation and preserve project-level Vercel protection.

## 6. Remaining blockers and risks

1. **Physical owner iPhone acceptance of v2** — open approval-review preview above, choose the *same* ZIP, verify \`FB-IMPORT-LOCAL-COUNTS-v2\` honest observed-year/type denominators, skipped-file reporting, cancel/clear memory behavior, and local editing/keep/reject flow. If sharing results, paste *numeric-only* audit and/or local decision receipt; do not paste Facebook texts or screenshots exposing private excerpts.
2. **Sample completeness semantics** — coverage remains bounded by selection, 80-file limit, 8/32 MiB JSON budgets, imperfect authorship attribution from Meta filename schema, and 2,500 retained samples. \`observedRecognizedEntries\` may include duplicates and excludes content not processed; never equate this to all-time Facebook posts. Do not make demographic, health, political, psychological or identity inferences automatically from old content.
3. **Preview authentication** — Vercel protected access is a preview gate, **not** an authenticated Jhadina account for saving a memory. Do not bypass \`POST /api/personality/facebook/propose\` verified identity just to create pending records.
4. **Canonical durable Memory** — Supabase availability/incidents and Cloudflare D1 operator-controlled commissioning remain separate holds. Require live auth, cross-owner RLS/tenant isolation, pending/approve/reject/edit/forget, restore and next-session retrieval evidence before Memory activation.
5. **Current-main divergence** — 198 commits behind, 137 ahead. Audit newly changed files and merge conflicts/security posture; selectively reconcile FB-related work onto an up-to-date main-derived branch or new PR; preserve source evidence and avoid broad unrelated changes.
6. **Live personal Facebook connection** — Markifact's connected Facebook Page capabilities do **not** provide read access to \`avebookie\` personal-profile posts. Any Facebook Login \`user_posts\` scopes/app review are separate permission work and not prerequisites for local archive review.

## 7. Strict next sequence / operator script

**\`FB-RELATE.LIVE.ACCEPT.01–.06\`**
1. **.01** Reconfirm branch SHA and Vercel protection; reuse READY review preview, no production deployment.
2. **.02** Owner opens the review preview on iPhone Safari and selects the existing local ZIP; validates actual counts-v2 report (file read/skipped, observed by year × kind, sampled by year × kind). Share **only** \`FB-IMPORT-LOCAL-COUNTS-v2\`.
3. **.03** Owner tests keep, reject, edit→undecided and deliberate “Use selected cues” composition, and copies \`FB-RELATE-LOCAL-REVIEW-v1\`. Confirm no write was attempted and the receipt makes no account-wide absence claim.
4. **.04** Test cancel/clear/reset on iPhone; ensure no stale selected cues or excerpts leak after reset. Add source regression only if actual acceptance reveals issues.
5. **.05** Separately audit canonical proposal API prerequisites (login, same-origin, owner identity, durable Memory availability). Do **not** execute a write until owner expressly approves a specific note and destination.
6. **.06** Prepare a bounded real-owner acceptance checklist for future pending/approve/edit/reject/forget/cross-owner/next-session flow; keep run-time Memory **HOLD** if authorization or infrastructure evidence is missing.

**\`FB-RELATE.MAIN-RECONCILE.01–.03\`**
1. Compare PR #1351 against current \`main\` and current security/memory route behavior.
2. Carry over smallest relevant validated changes selectively, resolve source conflicts, preserve ZIP and privacy regressions.
3. Run exact-head CI + deployment protection/security certification; leave draft/unmerged until both code-provable and operator-required evidence pass.

**Don't:** Upload the full ZIP, send private excerpts to GitHub, connect Facebook profile with a password, initiate posting/ads, create/promote memories, remove Vercel deployment protection, commission production D1/Supabase, merge PR #1351, or widen public visibility without separate owner instruction.

## 8. Handoff completion definition

**Completed:** code/protected preview for reading and reviewing; numeric local audit; CI; versioned source documentation.  
**Not completed:** owner acceptance of latest coverage+approval preview; verified all-time total; a legal/approved live personal Facebook API integration; owner-authenticated durable Memory writes and end-to-end governance; current-main reconciliation; release to production.

**Resume phrase:** *Continue \`FB-RELATE.LIVE.ACCEPT.01–.06\` from PR #1351 head, then \`FB-RELATE.MAIN-RECONCILE.01–.03\`. Preserve source-only and owner-only privacy holds; separate Safari/device evidence, canonical Memory runtime evidence and code CI; do not auto-approve or publish.*

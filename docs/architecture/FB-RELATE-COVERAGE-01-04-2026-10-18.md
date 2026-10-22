# FB-RELATE.COVERAGE.01–.04 — Local Facebook writing coverage and sample balance

Status: **source-only in draft PR #1351**. No production or preview deployment in this sequence. Owner's earlier private Safari run established ZIP readability of 680,688,714-byte archive (3 allowlisted JSON files, 2,500 bounded samples across 2010–2026), but **not full historical completeness**.

## .01 — Count only what was actually scanned
- Read all recognized owner-written text entries **within successfully parsed and byte-bounded allowlisted JSON**, including entries not retained in the sample.
- Add numeric `observedWritingEntries` and `observedYears` (post/comment split) to `FacebookImportPreview`; sum across multipart exports.
- This denominator is **not globally unique**: identical writing duplicated across files, shards or records may count more than once. It excludes unread/skipped/unsupported files and posts never included in Meta's export.
- No private post body, raw filename, account ID or date/time is copied in the audit.

## .02 — Keep 2,500 max while balancing by year and content kind
- `BalancedWritingSampler` uses a bounded in-memory sample, on-device deduplication of retained text, deterministic within-bucket reservoir replacement and quota rebalancing for scarce year+post/comment strata.
- No unbounded list/Set of discarded writing. The sample remains capped at **2,500**, including up to six input ZIP/JSON segments.
- File safety remains **8 MiB per compressed/uncompressed JSON**, **32 MiB aggregate eligible JSON per archive**, **80 eligible files per archive**; ZIP index metadata is read in small local slices. No Messenger/friends/security/media ingestion.
- The algorithm deliberately oversamples scarce year/type strata for representation. **Sample proportions are not true activity frequencies**. Census totals are also not an exhaustive account total.

## .03 — Separate observed denominators from sample counts on iPhone
- UI shows recognized entries and observed year/type counts from successfully parsed JSON, independently from sampled writing rows.
- Skipped-file count and sample limits are visible. Reached limits mean **partial** coverage.
- Aggregate-copy schema `FB-IMPORT-LOCAL-COUNTS-v2` adds `observedRecognizedEntries`, `observedYears`, limit metadata, and `sampleLimitReached`. It retains `completeHistoryVerified=false` always and never includes raw posts/comments or source filenames.
- The v1 owner-provided report (2,500 samples) remains valid **as a historical sample result**; v2 is not backfilled from it.

## .04 — Tests and acceptance boundaries
- Synthetic tests cover census counts above 2,500, year/post/comment stratification, deterministic repeatability and rare groups, six-file bounds, excluded Messenger content, unread malformed JSON, and copied-audit privacy.
- GitHub source tests/CI can prove code structure and synthetic correctness but **cannot certify the owner's real Facebook corpus proportions** or on-device resource consumption.
- Owner follow-up: optionally load the same local ZIP in a protected preview once a separate preview deployment is authorized. Check `observedRecognizedEntries`, `observedYears`, file skips and truncation; share only copied numeric counts. No new archive download or re-export required.

## Hard stops
- No persistent writes, Supabase/D1 schema/production migration, raw archive upload, personality activation, Jhadina training, publishing, spending, Facebook OAuth scope changes or access widening.
- Draft PR #1351 stays unmerged. Approval/forget/rollback belongs to **FB-RELATE.APPROVAL.05–.08**, requiring separate owner consent and downstream runtime evidence.

Tracking: [#1355](https://github.com/bookieandco/crispy-waddle/issues/1355), [#1360](https://github.com/bookieandco/crispy-waddle/issues/1360).

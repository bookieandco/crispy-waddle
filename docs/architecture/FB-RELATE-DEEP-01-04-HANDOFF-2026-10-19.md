# FB-RELATE.DEEP.01–.04 — Source-only closeout / privacy boundary

**Scope:** Draft [PR #1418](https://github.com/bookieandco/crispy-waddle/pull/1418), existing current-main-reconciliation branch. No production merge, live Memory write, Supabase/D1 change, public deployment or Facebook raw-content transfer authorized.

## Verified owner acceptance before this change (October 19)

Owner's real iPhone Safari screenshot showed that the **three selected October 19 JSON files** were parsed successfully, with **16,450 recognized owner-writing occurrences** and **2,500 distinct retained preview samples**. This is the already-observed local coverage figure, not a complete Facebook account history or evidence of durable Jhadina Memory. The previous day's ZIP is excluded from acceptance; the later three-file export is the reference scope.

## Implemented source changes

- **DEEP.01 — Corpus invariants:** A synthetic 17-year numerical fixture checks 9,321 observed posts + 7,129 observed comments = 16,450 entries across three allowlisted JSONs; at most 2,500 retained samples. It asserts separate census/sample denominators, all represented years, and `completeHistoryVerified=false`. These numbers are already disclosed aggregate test references; fixtures contain **invented writing only**.
- **DEEP.02 — Stable input balance:** Sort selected file handles by filename and byte length before processing so iPhone picker selection order does not change sampling for distinguishable files. Existing bounded year × type reservoir retains rare years and post/comment representation. Previously retained normalized identical strings do not inflate the sampler's accepted-offer counts. Numeric census remains unmodified and includes repeated wording. Synthetic tests assert selection-order stability, sparse periods and duplicate semantics. Same-name/same-size files and exhaustive unique-account dedup are **not** certified.
- **DEEP.03 — Contextual writing forms:** A separate read-only module computes **fixed-rule numeric indicators** for direct conversational address, rhetorical-form questions, informal word forms, narrated sequences and dialogue framing. This is language-dependent evidence of textual patterns, never a verified attitude, identity, story, instruction or author persona.
- **DEEP.04 — Cautious humor forms:** The same module counts explicit laughter/joking markers, possible ironic-contrast expressions, strong exaggeration phrases and turn/contrast transitions. These are *potential signals*, not detection of sarcasm, intent, jokes, comedic timing or wordplay. Every returned object includes only fixed-language IDs/labels/explanations, category counts, denominator and "surface-pattern-only" reliability.
- **Local interface:** The review page shows a separate **Deeper writing patterns · local preview** panel. Existing six owner-approval candidate cues and opt-in memory proposal remain untouched; these nine new indicators do **not** become candidates or automatically produce a note.
- **Source tests:** New synthetic tests for aggregate record/cap checks, file order, rare strata, repeated captions, indicator categories, sample cap, no raw text output and non-inference; existing page smoke test checks read-only caution copy.

## Safety and limitations

- Only positively allowlisted owner-authored posts/comments JSON is processed; no Messenger, third-party writing, photos, metadata upload or Facebook API.
- Original text is still processed transiently in the browser's bounded sample. Deep indicators output fixed labels and numeric counters; do not place private phrases, file IDs, original archive filenames, source paths, links or fingerprints in telemetry, logs, CI, PR descriptions or approvals.
- No large language model, embedding, demographic inference, clinical interpretation, sarcasm classifier or automatic personal Memory training is run in this sequence.
- The local 2,500 limit is preserved; repeated content across distinct dated posts can remain in observed census. Outputs cannot support population-wide statistical conclusions.
- No backend authentication or storage recovery is implied. The Supabase SWLC `57P03` problem, Cloudflare D1 operator onboarding, two-owner RLS, durable approval/forget and next-session recall remain separately gated.
- All six owner-review cues default to undecided; advanced numeric indicators are never enabled for persistence or personality mutation.

## Acceptance separation

**Code-proven when exact-head tests pass:** Pure deep signal rules, synthetic dataset reconciliation, existing isolated import/privacy mechanics and render markup.

**Not proved by source checks:** Physical iPhone behavior of this new panel, live humor understanding, quality of user-specific expression analysis, current-main merge safety, real-world backend authentication, cross-owner isolation and Memory durability. A private owner-protected exact-head preview and fresh iPhone screenshot are required before marking new UI accepted.

**Next sequence:** DEEP.05–.08 (over-time variation with fairness diagnostics, richer owner-reviewed profile drafts, private dashboard acceptance, and regression/reconciliation), then separate authorization for durable Memory.

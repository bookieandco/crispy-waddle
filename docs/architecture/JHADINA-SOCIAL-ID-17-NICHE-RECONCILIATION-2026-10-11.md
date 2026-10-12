# SOCIAL-ID.17 — Social Juggernaut safe niche forward-port
**Date:** 2026-10-11. **Starting base:** #1210 draft head `a5c4c3c23a9be5e312bae568eb0cdb836724cf01`.

## Audit/repair status
`SOCIAL-ID.16` is **BLOCKED_FOR_AUDIT_REPAIR** in GitHub issue #1211. It is not certified, and no production DB migrations or provider canaries are undertaken in .17.

## Why this code
PR #1136 `buildNicheAlgorithmProfile` filtered niche+platform+date without required owner/brand/account checks; PR is still open/divergent. Rather than merging it wholesale, .17 forward-ports a **fail-closed bridge from the existing Social source observations into the new owner/brand-scoped Growth niche aggregation**.

`apps/jhadina-web/src/lib/social/scoped-niche-learning.ts`
- Input accepts only bound connected accounts with reviewed expression-only identity and account+owner+brand+platform identity scope.
- Requires server-attested content membership and exact niche assignment with content reference receipts; model/browser-supplied IDs are not to be trusted at runtime.
- Admits only performance observations under Social's actual exact owner/brand/account/provider/provider-profile guards.
- Requires numeric impressions, views, shares and conversions instead of converting unknown metrics into fabricated zeros.
- Qualified confidence threshold defaults to 0.65; retired observations/source receipts are not promoted. Per-account or across-account within the *same owner and brand* are the only scopes.
- Outputs Growth `ScopedSocialNicheProfile` or `INSUFFICIENT_EVIDENCE` with explicit no publish/no personality mutation/no identity change authority. Even strong correlation is **observed analytics, not a causal platform algorithm law**.
- Tests include same-niche mixed brand, cross-owner contamination, forged provider profile, missing verified content, missing data, stale/future, duplicate and revoked evidence, account-specific filtering.

## Remaining #1136 reconciliation
Still NOT DONE: merge/rebase of original branch, import of richer mechanics/format/time-window data, weekly paid-comment-Director packet enforcement and production callsite integration. This is a source-only safe bridge and does not certify live growth or trigger any external action.

## Next
Only after source tests pass and PR stack reviewed: .18 read-only owner-scoped dashboard/Ask Growth insights with consistent evidence; .19 #1136 weekly identity integration behind Action/Security immutable receipt. Separately keep .16 blocked until issue #1211 actual DB repair, isolated schema rehearsal, independent restore and production multi-account provider proof.

# JHADINA SOCIAL-ID.18–.19 — Account Growth readouts + weekly packet reconciliation
**Recorded:** October 11, 2026. **Source base:** draft #1212 head `52ae976c5703fcc3709382efe64a608c108bed05`. Branch stacked on draft #1212 -> #1210 -> #1209 -> #1208 -> #1207 -> #1206. None merged to main.

## .16 still BLOCKED_FOR_AUDIT_REPAIR
Issue [#1211](https://github.com/bookieandco/crispy-waddle/issues/1211) tracks SWLC DB repair, migration inventory, isolated backup restore, owner approval receipts, multi-session real provider canaries and deployment. This coding milestone explicitly does **not** claim .16 live completion.

## .18 — precise read-only Social Growth insights
- `apps/jhadina-web/src/lib/social/social-growth-insights.ts` owner+brand+account+provider/profile/platform filters observations; dedups identical observation IDs, filters invalid/future metrics, exposes observed numeric totals only, and marks them observational and potentially overlapping, NEVER causal platform law, ROI or reviewed identity growth.
- If a trusted server explicitly supplies owner-verifiable account identity/content/niche lineage, it may calculate the existing `buildGovernedSocialNicheProjection` as `ACCOUNT_SCOPED_ADVISORY`. None is assumed available by default; it is not assembled from browser or raw observations.
- Ask's `growth_insights` operation takes resolved connected accounts, returns cited receipts and caveats, never public action. The phone Identity Studio presents an observation summary per account, distinct from the governed identity and raw evidence timeline.
- Tests: original-source Social observations, foreign owner/provider, unknown missing metrics, duplicate observations, nonexistent selected account, forged niche binding, and no identity promotion.

## .19 — #1136 selective weekly campaign reconciliation
- `packages/social-core/src/weekly-campaign.ts` was selectively forward-ported from PR #1136 (exact branch commit `df425645b8e92e2d0dea1d045ef7cca91095f53f`), preserving rich organic/comment/paid/Director proposal types, campaign consistency validation, immutable action assembly, report and whole-packet fingerprinting.
- **Security difference**: original `bindApprovedWeeklySocialCampaignPacket` and its `ApprovedWeeklySocialCampaignPacket` interface were intentionally NOT imported. That source function took caller-supplied fingerprints/receipt strings and returned `externalActionAuthorized: true`. There is no direct unchecked approval promotion in this forward-port.
- `weekly-campaign-identity.ts` binds the actual compiled weekly packet fingerprint, owner, organic/comment social account targets and verified current effective account identity fingerprints and version. Director/paid actions are included in the *packet* fingerprint; they do not become social account identities. Paid provider-account authority and Director production have separate existing gates.
- Any post, comment, media brief, budget, schedule, account persona/version or owner mutation invalidates the composite fingerprint. `assertIdentityBoundWeeklyReviewCurrent` **only** returns `REVIEW_FINGERPRINT_MATCH_ONLY, canExecute:false`; it does not authenticate receipt issuance or mint child action permits.
- No provider dispatch, scheduling, comment, spend, DDL or paid/AI generation is triggered.

## Certification and non-goals
Run exact-head Social Core and Growth types/tests, Ask/Identity Studio web tests, full UX/Launch/JLLM, and regressions for all four action types with identity drift and receipt tampering. PR #1136 is NOT merged in its entirety; broader ventures, platform features, scheduled workers and its old approval scheme remain unmerged. Actual Action/Security runtime adapter and owner-signed batch receipt verification are not production-commissioned. Cross-brand learning remains prohibited by default.

## Next
Do not lose issue #1211. Review the stacked PRs; then add server-bound owner-reviewed weekly packet receipt verification and child permits only after independently verified trusted storage/approval infrastructure. Continue non-DB code-only certification and source reconciliation while .16 is blocked.

## Approval provenance hardening (follow-up commit)
The selective #1136 source fingerprint was upgraded from v1 to v2 to include packet creation timestamp, campaign names, campaign/action/profile supporting evidence refs, public-comment commercial relevance refs, report evidence and risk flags. The old v1 ignored several of these changes. Any change now invalidates the composite review identity binding; version bump prevents reusing historical v1 reviews. Tests cover evidence replacement and campaign rename. Still no verified server-approved action permit.

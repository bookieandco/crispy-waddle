# SOCIAL-ID.05–.09 — Source implementation & staged merge handoff

Base: `feat/jhadina-social-id-00-04-20261011` @ `f4da71ea77261bd80156b34a99102078aed4c6dd`.
Full PR #1136 remains divergent and is **not** merged or changed by this PR.

## Implemented
- .05: `admitSocialIdentityPerformance` requires a connected and verified owner/brand/account/provider/platform identity, exact approved content ID, provider evidence, bounded confidence/metrics and freshness. Raw trends and ownerless/brandless observations cannot silently become account identity learning.
- .06: `buildScopedSocialNicheProfile` provides owner+brand+niche+platform (optional account) scopes, supports deliberate within-brand aggregation and fails closed on mixed brands or tenants.
- .07: `proposeEvidenceBackedSocialIdentityChange` requires 3 currently supported, sufficiently confident observations across at least two distinct posts/actions; output is an inert `REVIEW_ONLY` proposal that does not mutate identity.
- .08: evidence retirement/expiry reconciliation and `assessSocialIdentityDrift` issue minor/material/major review receipts; no automatic promotion.
- .09: `proposeCrossAccountSocialLearning` shares only enumerated abstract creative mechanisms as experiment candidates, never voice, identity traits, personality, text, private audience records, permission, or automatic publishing.

## Important limitations
1. Pure validation functions cannot authenticate their inputs. `verifiedContentIds` and `verifiedOwnerUserId` are trusted-server boundary parameters, **not** browser fields. Production adapters must look them up from authenticated repositories; no new runtime endpoint in this source milestone.
2. Evidence ID count does not prove genuine independence, exposure normalization, causality, audience consent, data rights, or platform validity. It gates only what this layer can safely propose.
3. Identity proposals are not memory writes. The CAS/owner approval/immutable persistence contract from .03 still needs a concrete durable adapter and signed receipts after SWLC recovery.
4. `buildScopedSocialNicheProfile` is a standalone safe alternative contract. PR #1136's `buildNicheAlgorithmProfile` has not been modified; full reconciliation must **replace or guard** that call before joining both branches.
5. No claim of live growth, provider sync, durable multi-session learning, or production deploy. Existing Social/Personality authorities remain unchanged.
6. Owner-defined brand expression must remain separate from Jhadina PersonalityState and RNC. MIMS remains advisory.

## Regression requirements
- Foreign owner/brand/account/provider/profile/platform rejection.
- Missing owned content binding; stale, future, negative, NaN and low-confidence observations.
- Same niche but different brands fail; same-brand multiple accounts allowed only at owner/brand scope.
- Deduped independent evidence; revoked evidence retires dependent proposals.
- Drift stays review-only; cross-account transfer is typed mechanism-only.
- Exact-head Social Core, Growth, Personality Core and Web regression CI green.

## Next execution
.10 effective identity precedence (character -> brand voice -> channel -> account);
.11 Director/ContentProject identity version and immutable asset SHA bindings;
.12 weekly packet fingerprints and reapproval integration (after #1136 reconciliation);
.13 Ask read-only social identity explanations;
.14 phone Identity Studio;
.15-.16 live commissioning/recovery gates.

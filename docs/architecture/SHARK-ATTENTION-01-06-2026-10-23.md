# SHARK-ATTENTION.01–.06 — Public catalyst research bridge

Date: 2026-10-23 (America/Los_Angeles)
Status: SOURCE ONLY. Draft review is required; no merge, deployment, notifier, Telegram connection, wallet action or live order.

## Source / rationale

The uploaded tutorial describes news catalysts, social-post views, rival token contracts, whale/dev activity and reactive price alerts. Its reported profits are the speaker's assertions, not independently audited trading evidence. This implementation extends the canonical SHARK research package, without creating a second bot, scanner, trading ledger or signer.

## Delivered

.01 Narrative researcher: attention-research.ts groups public ARTICLE and SOCIAL_POST metadata by claim and source host. MULTI_HOST_REPORTED is NOT independent verification of a narrative.
.02 Rival contracts: exact Solana mint identity, market-cap and volume claims, configurable thresholds, UNVERIFIED_MARKET_REPORT output.
.03 Public social trend: computes view delta only from actual ordered snapshots of the same public source item.
.04 Position risk: attention-position.ts routes adverse evidence to canonical reviewMemePosition, preserving or increasing negative risk inputs, never adding confidence.
.05 Alerts: pure stable alert payloads for price moves, rival contracts, retractions, distribution and liquidity. They cannot send push/Telegram/SMS notifications or place orders.
.06 Paper paired study: attention-paper-evaluation.ts rejects hindsight evidence and duplicate cases, compares injected hypothetical NET returns against the on-chain-only baseline. Never independently verified alpha, never real fills.

Tests: packages/shark-intelligence-core/src/meme-trader/attention-research.test.ts.

Commands:
pnpm --filter @jhadina/shark-intelligence-core type-check
pnpm --filter @jhadina/shark-intelligence-core test

The exact-head workflow, source-provider behavior, alert delivery and execution authority are NOT certified by the code alone.

## Trust and policy

- NO Telegram API data, private/group chat content, sender details or raw messages enter this AI/ML research module. Telegram API §1.5 constraints still require legal/platform review.
- Public metadata only. A supplied publicOnly flag is NOT proof of provenance; a later authenticated public-source adapter must verify that boundary. This file intentionally performs no scraping or network fetch.
- Only a small allowlist of primitive fields is permitted. UTC chronology and cutoff; bounded evidence batch/age; HTTPS URL without embedded credentials, local hosts or raw query; no text fragments.
- Many publications repeating a claim do not prove the claim true. Views or token narrative do not imply expected profitability.
- SHARK signals remain RESEARCH_ONLY. Money Core/Coffer remain authoritative for risk, budgets, signer and capital. Phantom ownership proof is not trading authority.
- No vendor credentials, paid API, Telegram listener, wallet keys, Railway/Vercel/Supabase writes, notifications or trades added.

## Outstanding acceptance gates

1. Review exact PR head against main; run core tests, TypeScript and required workflows. Document actual status rather than assuming success.
2. Commission separately authorized public news/market/on-chain metadata readers with source identities, licensing, honest timestamps, deduplication and corrections.
3. Bind sourceItemId to a globally unique public provider identity; do not correlate IDs across independent sites without evidence.
4. Prospectively observe decisions and quote/fee/slippage paths for both baseline and attention models, with losing cases included; keep hypothetical paper numbers separate from actual observed fills.
5. Separate approval for owner notification delivery and any persistent worker.
6. Separate governed Money/Coffer canary, signer/budget, reconciled settlement and explicit authorization before real-money trading.

Branch: feat/shark-attention-research-01-06-20261023
Base: main. This addition is independent from existing unmerged SHARK sniper, Telegram and signer stacks. Reconcile those drafts before future integration.

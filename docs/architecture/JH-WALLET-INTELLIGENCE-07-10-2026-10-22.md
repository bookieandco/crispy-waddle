# JH-WALLET.INTELLIGENCE.07–.10 — owner Phantom read-only acceptance

Date: 2026-10-22
Parent: draft PR #1457 (hardened Ed25519 ownership challenge).
Scope: code-only review and read-only evidence; **not** production commissioning.

## Grounded owner-side evidence (private checks; never commit real wallet address)
- Jhadina Supabase: money_wallet_connections contains an ACTIVE, OWNER_WALLET, phantom, SOLANA record with Ed25519 ownership-challenge evidence.
- Corresponding jhadina_wallets row: ownership_verified=true, observation_enabled=true, trading_enabled=false.
- Ownership challenge: single-use nonce consumed before expiration.
- No COFFER_EXECUTION_WALLET for this owner; DEX connector registry still UNCOMMISSIONED.
- The separate Jhadina Vercel deployment inspected is READY, but *not this branch*. No real iPhone acceptance, RPC balance receipt, deployment or transaction is asserted.
- The reviewed Vercel project environment-variable key listing did not contain SOLANA_RPC_URL. This branch supports bounded manual reads via the official, **rate-limited and non-production** Solana public RPC endpoint; separately approved read-only RPC configuration is needed for reliable operation.

## .07: UI/ownership
- Reuse hardened canonical Phantom card from #1457, not legacy main-branch, address-only connection endpoint.
- Keep distinction between server-verified ownership and locally connected Phantom provider. Safari can show saved/verified without claiming local provider presence.
- Added manual Refresh SOL & recent activity UI, with observed timestamp, RPC slot and at most 10 signature summaries. No claim of transfers, portfolio accounting or realized profits.

## .08: chain observer and authenticated route
- wallet-readonly-observer.ts has exactly two RPC methods: getBalance, getSignaturesForAddress (max 10), commitment confirmed, HTTPS-only endpoint, fixed timeout, bounded JSON response, strict public key validation and no caching.
- /api/money/wallet-observation GET never accepts user-selected addresses, arbitrary RPC methods, signer endpoints or trade requests.
- Authenticated Supabase getClaims owner must have both an ACTIVE OWNER_WALLET connection and matching jhadina_wallets verified+observation-enabled row.
- No reads from disconnected wallet, no arbitrary-account lookup, no private keys or tokens returned, no service-role key to client.
- Fails closed with non-sensitive error codes; Cache-Control: private, no-store.

## .09: research isolation
- toShadowWalletResearch converts owner observation to bounded, evidence-only contract. SHARK / Shadow Learn can use only explicit data, never infer cost basis, spendable Coffer cash, verified profit, route execution or money permissions.
- No automatic Shadow persistence or background worker is authorized by this PR. Independent read-only journal/consumer must pass future review before live integration is claimed.

## .10: acceptance
- Money R13B includes deterministic tests for onchain RPC methods, malformed records, owner isolation, observer authorization and shadow no-trade invariants.
- Existing SHARK paper and risk CI are separate tests of simulation, **not a real wallet-backed acceptance**. Review current PR exact-head CI before merging.
- Manual private iPhone acceptance required: sign in to Jhadina, see saved wallet, open Phantom only for provider state, tap manual refresh, verify exact address in session and compare balance/signatures with a second trusted Solana explorer. Never enter seed phrase.
- RPC 403/429, empty history, unavailable network, expired Jhadina session and account switching must be displayed as errors, never converted to success or guessed financial figures.

## Integration/deployment blockers
1. Parent PR #1457 is draft and unmerged; do not overwrite proof logic using GitHub main.
2. New branch is review-only, not deployed. Restore protected preview login for private device testing, not a broad Vercel bypass.
3. A real independent chain receipt and Phantom iPhone test remain unverified.
4. DEX execution wallet, signer lease, funding evidence, connector admission, and live trade approval remain separate and disabled.

No production deployment, merge, project-wide auth change, wallet signing, transfer, swap, live execution or paid service has been authorized/performed.

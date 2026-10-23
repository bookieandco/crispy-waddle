# SHARK-SNIPER / PHANTOM.WALLET.24–.26 — 2026-10-23

**Status: source-only, DRAFT, not merged, no Railway/Vercel/Supabase writes.**
No Telegram collection, model learning, paid providers, live trades, real
signatures, swaps or wallet custody occurred in this sequence.

## .24 — independent public discovery into canonical SHARK paper ledger

`ops/meme/shark_sniper_paper_audit.py::audited_public_paper_cycle`
wraps **existing** `shark_live_intelligence.tick` and private SQLite
`local_database`, reusing fixed public DexScreener profiles/boosts, the
canonical Solana mint dossier and prospective 24–30h, same-pair, price-only
study/censoring. It is deliberately NOT a second token scanner, Telegram
intake, scheduler or automatically commissioned runtime.

- Requires `FIXED_PUBLIC_DEX_PROFILES_BOOSTS` caller-supplied source label,
  already-fetched PUBLIC list feeds, a verified-format public mint dossier
  reader, and a caller-provided fresh wall-clock after provider receipt.
  Caller source labeling is a declaration, not cryptographic verification.
- Rejects chat-origin source kinds, raw text/sender/chat/forward fields and
  non-list inputs before entering the canonical ledger. An attacker could
  mislabel external data as public: enforce source trust at an authenticated
  adapter/network boundary before any future unsupervised live ingestion.
- Persists only the *existing* public research ledger at an owner-controlled
  private path and its existing idempotency/retention constraints.
- Returns `sniperPaperReadyForReview`, zero orders/zero signatures, no
  real-money authority. **Not a deployment**: there is no new provider pull,
  scheduler, notifier or wallet link here. Existing public market worker
  remains an independent project subject to its own release.

## .25 — measured local-cycle timing + friction *assumptions*

- Monotonic `localCycleMs` surrounds only the bounded **local paper
  cycle**. No discovery websocket receive time, launch-to-decision time,
  live quote age, remote provider round trip, order simulation, broadcast
  latency, network finality, exit execution or complete P&L is certified.
- `hypothetical_round_trip` models separate entry and exit fee/slippage,
  per-side market impact plus an assumed total network/priority fee, with
  checked decimal limits and impossible-cost rejection.
- Outputs have `disposition=ASSUMPTIONS_ONLY_NO_LIVE_QUOTES`,
  `actualFeesMeasured=false`, `actualSlippageMeasured=false`,
  `fillOccurred=false`, `canTrade=false`.
- This is not a measurable 0.6s discovery-to-fill claim or real sniper
  execution simulator. Actual priority fee, LP price impact, MEV, sell
  availability, failed transaction and fresh route quote require separate
  market evidence. Fake fixture gains never count as verified profit.
- Six new offline test cases exercise canonical SQLite ingestion,
  source quarantine, measured local timing and costly two-sided scenarios.

## .26 — server-verified Phantom ownership; observation only

Files:
- `src/lib/wallet/server-proof.ts` uses Node's native Ed25519 to verify an
  actual Solana public key (strict base58 decoding) and 64-byte signed
  message. No third-party custody or private keys.
- `src/app/api/wallet/ownership/route.ts` authenticates a provider-verified,
  allowlisted personal owner via `createClient().auth.getUser()`, validates
  same-origin POST/DELETE, requires privileged server-only Supabase client,
  rate-limits issuance (three challenges per minute), creates random
  32-byte hex nonce and 5-minute expiry, and binds the challenge to the
  authenticated owner in a new service-only table. POST verify checks the
  stored exact message, owner, wallet, unexpired unused nonce and real
  Ed25519 signature before an atomic one-use update and durable upsert.
  Replay/expiry/owner mismatch cannot promote ownership. If persistence
  fails after nonce consumption, the owner must request a new challenge.
- GET status reads only the authenticated owner's address; DELETE revokes
  the owner's server-recorded observation binding.
- `PhantomWalletButton` signs exactly the server message, checks account
  key before and after signing, and only displays verified after server
  confirmation. Browser localStorage always downgrades old
  `ownership-verified` states; browser flags are not financial authority.
- New migration `supabase/migrations/20261023000100_wallet_owner_challenge.sql`
  creates two RLS-on, client-privileges-revoked service-only tables.
  The durable wallet row has SQL constraints `trading_enabled=false`,
  `can_sign=false`. **Migration NOT applied** and not yet certified
  against real production schema. The endpoint fails closed if privileged
  infrastructure or tables are unavailable. It does not create a
  Money/Coffer signer lease, capability or spending authorization.
- Vitest uses generated in-memory Ed25519 test keys, wrong address,
  tampered nonce/domain, altered message and invalid format cases.

## Holds / gaps before production

1. Review dependent source chain #1464 → #1490 → #1491 → #1495 →
   #1502 → this draft, then exact-head workflows. None is merged here.
2. Verify real Supabase migration compatibility, owner identity and
   Vercel protected authenticated deployment in a nonproduction preview.
   No database update or rollout was authorized by this request.
3. Test server's real issuer/replay race and DELETE/G​ET using an actual
   authenticated owner plus privileged backend; verify same-origin behavior
   behind Vercel proxy, and remember mobile Phantom can be browser-injected
   only in the compatible wallet browser.
4. Repair any existing wallet observation routes still allowing arbitrary
   typed addresses to masquerade as a verified owner. The new status API
   alone does NOT certify those other routes. Audit the whole execution
   allowlist and prohibit browser-local proof flags as an authority source.
5. Commission actual independent-public chain feed provider, long-lived
   *public* host, quote-age/fee/liquidity telemetry, persistent prospective
   paper outcomes and explicit stop conditions separately. No Telegram
   API content may be fed into SHARK/JLLM/Shadow Learn for AI/ML.
6. Only afterward review Money/Coffer charter, signer leases, DEX
   provider authorization, owner budget and kill switch. Live trades require
   a new explicit permission and real signed/broadcast canary; current
   deployment remains a dormant Telegram worker.

Do not deploy the new code automatically: Railway is still pinned to
`3eb33ce62e1f347fcc402ead62d3b2a5ebf118b3` (disabled process).
All numerical costs from `hypothetical_round_trip` are assumed scenario
arithmetic, not proof of achievable fills or actual profits.

# MONEY-FINAL repository + handoff audit — 2026-09-20

## Scope

Audited current `main` Money Core, Jhadina web Money composition, live Swlc/Supabase Money tables, SHARK, sports ingress, stock/FX/live-canary work, Capital Lab boundaries, repository provenance records, and the September 18/20 Money handoff requirements.

This pass also reconciles the explicit handoff request for precious metals, which the prior R13B certification still recorded as an unbuilt next domain.

## Preserved invariants

- Action Core owns authorization. Money execution permits are downstream proofs, never a second policy authority.
- Intelligence/prediction is evidence, not execution. Sports ingress remains `INTELLIGENCE_ONLY` with betting/financial authority `NONE`.
- Non-meme stocks/forex remain manual-canary-only; no autonomous stock/forex execution was enabled.
- XAU/XAG/XPT/XPD are now first-class Money research assets, but metals reality/intelligence creates no order or trade authority.
- SHARK/meme intelligence remains isolated from the protected Money read/banking spine and does not gain protected-fund authority.
- Read != write != approval != execution. Unknown provider execution blocks further attempts until reconciliation.
- Protected reserves/capital allocation, exact-money/accounting, idempotency, reconciliation, kill switch and durable provider-event processing remain canonical Money concerns.

## Repository reconciliation

### Confirmed current implementation

- `@jhadina/money-core` has a real package surface, exact-money/accounting primitives, durable idempotency/event processing, Action-Core authority binding, execution permits/attempts/recovery, Plaid read-only provider, stock/FX reality/intelligence, first-class prediction-market reality/intelligence, sports research ingress, live-canary controls, Alpaca manual-canary work and MONEY-055/MONEY-060 certification contracts.
- SHARK has its own package manifest/tests and materially implements DexScreener, Pump/PumpSwap, Raydium/Meteora liquidity, wallet/entity intelligence and adversarial risk evidence. Historical “package absent” findings are superseded.
- Sports -> Money is correctly narrow: prediction envelopes may become research evidence only and cannot pre-populate Money risk/authority.
- The historical duplicate Money `ActionProposal`/`PolicyDecision`/`AuditReceipt` authority concern is superseded by `action-core-authority-bridge.ts`; no duplicate Money authority type was found in current source.
- Capital Lab remains a read-only snapshot surface. The current Coinbase provider contract exposes account-read capability only; Send/Withdraw stay unavailable when the provider lacks those capabilities.
- Protected-capital controls remain explicit: allocation denies requests that breach `protectedReserveFloor`, and portfolio construction supports `MIN_CASH_RESERVE_BPS`.

### Repairs completed across MONEY-FINAL

1. Declared `@jhadina/action-core` as an actual `@jhadina/money-core` workspace dependency and declared `@jhadina/money-core` in the Jhadina web app that imports it; reconciled both lockfile importers.
2. Split Plaid access-token persistence from owner-readable bank authorization metadata. Credentials live in `jhadina_money_bank_credentials`, a service-role-only RLS table; browser roles have no table privileges.
3. Bound Bank Link exchange/disconnect and per-Item adapter resolution to verified request identity through the server-only service-role client.
4. Restricted browser/session access to owned active account IDs; clients cannot read Item credentials or mutate ownership rows directly.
5. Removed stale source comments that described the now-repaired ownership gap.
6. Applied the credential-hardening migrations to live Swlc and removed authenticated execution of legacy browser-callable mutation RPCs.
7. Unified the financial-mutation classifier used by intelligence rejection and ActionRequest eligibility so account changes, orders, trades, borrowing and allocation cannot masquerade as intelligence-only actions.
8. Applied live migration `20260920223551_money_final_least_privilege_closure`:
   - removed stale authenticated INSERT/UPDATE/DELETE ownership policies from Money bank connection/account tables;
   - retained authenticated owner-readable SELECT only;
   - retained service-role-only credential access;
   - revoked all anon/authenticated table grants from `money_research_cases`, `money_research_tasks`, and `money_research_evidence`, making their intended backend-only model explicit instead of relying on policy absence.
9. Added Money-related Supabase migrations to the Money R13B certification workflow path filters so future Money schema/security changes cannot bypass the Money gate.
10. Closed the R13B precious-metals gap with **MONEY-METALS-01/02**:
    - XAU/XAG/XPT/XPD identity;
    - spot/futures semantics;
    - venue, unit, purity, quote/settlement currency and contract settlement;
    - point-in-time bid/ask reality with future-data exclusion and expired-future rejection;
    - separate factor/regime/forecast/risk intelligence;
    - `RESEARCH_ONLY` decision cases with `authorityStatus=MISSING` and `financialAuthority=NONE`;
    - adversarial tests proving metals intelligence cannot become proposal-eligible by itself.
11. Closed the handoff prediction-market gap with **MONEY-PREDICTION-01/02**:
    - canonical binary/multi-outcome market identity, venue, open/close schedule and payout;
    - per-outcome point-in-time bid/ask implied-probability reality;
    - explicit resolution authority, rule version, dispute/void semantics and final-resolution admission;
    - visible complete-set arbitrage state instead of hidden probability normalization;
    - independent probability estimates, divergence, liquidity/resolution risk and post-resolution Brier learning;
    - `RESEARCH_ONLY` DecisionCase/DecisionAssessment with `authorityStatus=MISSING`;
    - adversarial tests proving prediction-market research cannot become proposal-eligible or self-authorize execution.

## Reference/handoff disposition

- Plaid: implemented read-only banking/provider boundary plus sandbox Link commissioning path.
- Coinbase: Capital Lab remains account-read-only and non-executing.
- OpenBB / StockSharp / Freqtrade: research references only; no current runtime dependency or unverified code reuse found.
- Polymarket / Kalshi: provider/repository references remain non-runtime until separately admitted, while MONEY-PREDICTION-01/02 now supplies the canonical provider-independent prediction-market reality/intelligence domain. No autonomous prediction-market execution path exists.
- SHARK references: DexScreener/CoinGecko/Helius provider paths are repository-traceable; Pump/Meteora/wallet-cluster references remain governed by the reference-provenance ledger and do not imply source-code derivation.
- Sports: one-way research ingress only; Money independently evaluates evidence, risk, capital and authority.
- Precious metals: prior handoff request is represented by MONEY-METALS-01/02 rather than remaining only as XAU/XAG/XPT/XPD enum declarations.
- Prediction markets: prior handoff request is represented by MONEY-PREDICTION-01/02 rather than remaining only as a PREDICTION enum, generic calibration types, and external-reference notes.

## Verification receipt

Code verification was performed on PR #486 code head `5dd0a344ae1771c9f0f5058f52fce26222a088f3`:

- Money R13B Certification **#233 — SUCCESS**
- SHARK Intelligence Core CI **#124 — SUCCESS**
- Spatial Conformance **#792 — SUCCESS**
- Jhadina Evolution Core CI **#1283 — SUCCESS**
- Staffing Postgres Integration **#2032 — SUCCESS**
- Director Targeted Tests **#199 — SUCCESS**

The live Swlc schema was re-queried after `20260920223551_money_final_least_privilege_closure` and verified:

- `jhadina_money_bank_accounts` / `jhadina_money_bank_connections`: authenticated `SELECT` only; service role full;
- `jhadina_money_bank_credentials`: service role only;
- `money_research_cases` / `money_research_tasks` / `money_research_evidence`: service role only;
- bank-account/connection RLS now exposes only owner-readable SELECT policies;
- the credential table retains its service-role-only policy.

## MONEY-FINAL closure status

### Repository/software closure — ACCEPTED

The recorded Money architecture, handoff, GitHub-reference, database least-privilege, stock/FX/sports/SHARK boundary, precious-metals, prediction-market, and deterministic CI gaps covered by MONEY-FINAL are closed in PR #486.

### Production banking commissioning — NOT ACCEPTED

This is intentionally a separate admission gate and is **not** being misrepresented as complete:

1. the fresh Vercel deployment for the closure branch is blocked by the account's deployment build-rate quota;
2. therefore this audit cannot prove that the currently deployed server has `SUPABASE_SERVICE_ROLE_KEY`, `JHADINA_MONEY_CREDENTIAL_KEY`, and `JHADINA_SECRET_PLAID_DEFAULT` configured server-only;
3. GitHub workflow history contains **no PL-8 live Plaid sandbox dispatch**;
4. the full authenticated Link -> private credential persistence -> owned account read -> governed transaction read -> durable audit -> disconnect -> post-disconnect denial commissioning drill has not been run against the deployed stack.

That commissioning state does **not** reopen the software closure and does **not** grant production-banking authority. Money remains fail-closed/read-only at that boundary until those receipts exist.

No result in MONEY-FINAL authorizes autonomous stock/forex/metals trading, protected-fund access by SHARK, automatic sports betting, prediction-market auto-execution, or bypass of Action Core. Prediction-market provider adapters/executors remain outside this closure.

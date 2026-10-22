# MultiHopper AgentPay — production integration review (not an approval)

Date: 2026-10-22. Decision: **NO-GO** for mainnet / signing / production integration.
Production work is deliberately excluded from PR #1493.

## Current facts
- Existing Money Core `wallet-connector-contracts.ts`: Phantom is owner-visible connection only; `canSign:false`; never store seed phrase/private key. Coffer execution wallet is separately governed.
- `MultiHopperDevnetReadOnlyClient` only implements estimate and two GET observations, with fixed devnet URL and test credentials.
- `/api/money/agentpay/quote` requires authenticated Supabase session and server-only key; opt-in feature flag defaults disabled.
- Sponsor API description: create -> prepare -> wallet-sign -> ordered broadcast -> confirm-broadcast, then monitor transfers + signed webhooks. **Not** just one token-transfer operation.
- Sponsor advises keeper funding first and immediately reporting keeper funding signature to prevent duplicate funding during recovery.
- Sponsor API pricing is asset/mint-dependent; decimals, USD-equivalent tier lookup and hop fees require verification.
- CI success proves compile/test pipeline on exact commit; no proof of mainnet readiness, external key access or real wallet usage.

## Threat / authority gate matrix
| Risk | Required control | Today |
| --- | --- | --- |
| Unauthorized recipient/payment | Payer identity and connected-wallet ownership attested; destination allowlist, payee confirmation, strong typed amount & mint | NOT IMPLEMENTED for AgentPay live transfers |
| Wallet compromise | User wallet adapter only for interactive owner signing; never export keys; separate Coffer mandate/permit for any future automation | OWNER BOUNDARY EXISTS; vendor flow NOT IMPLEMENTED |
| Duplicate payments | Deterministic per-business-obligation external ID, provider-side and DB idempotency, immutable approvals and single payment state machine | NOT IMPLEMENTED for AgentPay |
| Unexpected quotes, hidden costs | Confirm live mint support, hop count, stable quotes, fee range, SOL reserve, slippage when composed with swaps | DEVNET QUOTE UI ONLY |
| Multistep partial broadcast | Sequence keeperFundingTx -> routeInitTxs -> orchestratorInitTx -> sessionInitTxs. Confirm every on-chain signature and record keeper funding immediately before re-prepare. | NOT IMPLEMENTED |
| Webhook forgery/replays | Raw-body HMAC, strict parsing, event uniqueness, expiry or replay checks, provenance, independent onchain readback, secret rotation | HMAC HELPER PRESENT; RECEIVER NOT BUILT |
| Provider outage/compromise | Circuit breaker, durable queue, timeouts, retry with idempotent reconciliation, independent chain status, pause switch | NOT IMPLEMENTED |
| Key leakage | Server-only environment-scoped secret, preview-only for tests; no logs, browser payload or GitHub workflow access on unreviewed code | NO OFFICIAL KEY ISSUED |
| Privacy / compliance | Accurate claim of traceability; disclosures, consent, provider sanctions controls plus own applicable KYC/AML/licensing obligations | LEGAL REVIEW PENDING |
| Economic loss | Sponsorship/fee-sharing agreement, fees/rates and payout proof, minimum margin and treasury cap, customer support plan | SPONSOR REPLY PENDING |
| Abuse / fake volume | Independent business obligation, completed mainnet route, collected percentage fees, one principal counted once, nonrefunded/nonartificial evidence | PILOT PREPARED; NO REAL VOLUME |

## Future code change boundary (separate PR + owner authority)
1. `MultiHopperLiveTransferIntent`: immutable invoice ID, payer identity, mint/decimal/amount/recipient, quote expiry, cost cap; externally verified approval reference and idempotency key.
2. `MultiHopperExecutor`: separate service from quote code; require explicit `Money` capability authorization, signer's verified user intent, destination allowlist and risk checks before requesting prepare.
3. Persist every stage and each signature durably, including keeper funding confirmation, in PostgreSQL with unique constraints and audit trail.
4. Independent Solana RPC confirm plus webhook reconciliation. No duplicate/replay if provider reports inconsistent status. Make failure modes observable to the user and halt under uncertainty.
5. Mainnet environment/keys behind distinct protected deployment approval; no `mh_live_` credential used by devnet adapter.
6. Mobile integration tests on Safari iOS after preview with real authentication, successful quote and invalid quote, slow network, disabled key and logout. WCAG touch targets and accessible alerts.
7. Commission only after sponsor terms, compliance, formal security sign-off and a specific user-approved transfer authority with limits. Production deployment alone must not enable spending.

## Gates to reopen
- [ ] Current sponsor rules + written fee share with signer and payout terms
- [ ] Official devnet test key and executed READ-ONLY sample from authenticated owner session
- [ ] Independent sandbox/CI safety proof and actual iPhone browser QA
- [ ] Independent pilot customers with proven legal business reason and consent
- [ ] Compliance/legal assessment for payer/payee geographies and custody role
- [ ] Dedicated production implementation PR and comprehensive recovery/security tests
- [ ] Explicit owner approval for production credentials, deployment and **each live transfer scope**

Until all are satisfied: **NO production signing, mainnet routing, payments or customer funds.**

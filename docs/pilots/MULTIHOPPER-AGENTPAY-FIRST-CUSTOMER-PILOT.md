# Jhadina AgentPay — independent first-customer pilot

Prepared 2026-10-22 | Status: **planning only; no customers recruited or funds moved**

## Commercial hypothesis
Independent businesses making *existing, legitimate* Solana-denominated payouts may want an auditable mobile experience for quotes, approval, routing status and receipts. MultiHopper's published sponsor-page model illustrates 0.25% of full-fee qualifying volume as integrator revenue, **subject to written partner terms**; customer fees, extra per-hop costs, token/mint support and exchange costs must be disclosed. Do not promise savings, anonymity or guaranteed settlement.

## Pilot design (read-only first)
1. **Discovery**: 10 conversations with independent business payers and payees, 3 potential letters of intent, zero wallet access. Candidate profiles: a freelance creative agency paying independent contractors; a creator marketplace distributing earned royalties; a small software agency paying remote specialists. The payer must have a legitimate existing obligation and genuine independent economic activity. The founder's own businesses may test usability but must never be represented as independent customers.
2. **Quote-only alpha**: 3–5 consenting testers view fee estimates and mobile receipts using **test data** and a permitted devnet key; no signing. Collect comprehensibility, price acceptance, mobile errors and onboarding friction.
3. **Partner diligence**: sponsor written rules, entity/onboarding requirements, asset support, jurisdiction and compliance review, recipient identity/consent and sanctions screening responsibility assigned explicitly. If handling payroll, remittance, third-party funds or custodial activities, obtain qualified legal advice before production.
4. **Production readiness sign-off (separately approved)**: security review, threat model, signer separation, rate limiting, explicit owner wallet consent, customer payment authorization, exact destination allowlist, fees and FX disclosure, refund/recovery plan, signed webhook raw-body verification, reconciliation proof, idempotency and provider pause switch.
5. **Optional real customer pilot**: only once all prior gates are cleared and separately approved, execute a small number of genuine *customer-initiated* mainnet payouts for existing obligations. Treat a provider test transfer as unqualified until sponsor's attribution and fee records confirm otherwise.

## Evidence ledger (one entry per actual settled route)
Never inflate volume by hop count, recipient count, or recirculation. Preserve:
- Customer pseudonymous ID and consent evidence; payer's independent real-world business reason and invoice/contract reference.
- Signed authorization receipt; exact chain and mint; sender and verified recipient; timestamped quote and fee disclosure.
- Unique route externalId; provider transfer ID; chain transaction signatures; finalized route state and transfer-completed event.
- Amount in original native units; original quoted USD conversion rate and independent rate source/time.
- Percentage fee actually collected and paid; fee-equivalent qualifying volume as sponsor verifies; processor/chain/hop fees deducted.
- Outcome: completed, failed, refunded, reversed, suspicious, unverified or duplicate; only sponsor-qualified **completed, nonrefunded, nonartificial production** transfers enter bounty totals.
- Deduplication hash across route ID, external ID, business obligation, and onchain evidence.
- Approval and audit retention policy agreed with legal and sponsor, with sensitive data stored in access-controlled systems, **not GitHub**.

## Customer interview script (10–15 minutes)
- What obligation are you already paying, and how often? Which token/network, amount, recipients and locations?
- Who initiates and authorizes payments? What controls and records are currently needed?
- What is the current fee, delay, failure/recovery process and regulatory posture?
- Would an extra 0.5% percentage fee plus per-hop/network charges make economic sense? Under which use case?
- Could you verify an independent paid obligation with consent, and would you try a fee-quote-only alpha first?
- Do you need multi-hop timing/privacy? Is the provider's onchain traceability acceptable?
- Would you like follow-up details? Only contact people who explicitly opt in.

## Acceptance criteria
- [ ] Rules and partner commercial contract obtained in writing.
- [ ] Official devnet key configured in protected secret storage, preview-scoped; never client-side.
- [ ] Exact-head CI and quote-only UI usability on iPhone verified.
- [ ] 10 interviews documented with consent; >=3 independent eligible leads (not assumed).
- [ ] At least one independent customer *requests* a real business payout product.
- [ ] Owner-approved legal/compliance, security and production sign-offs recorded separately.
- [ ] Costs measured: fee percent + per-hop lamports + RPC + refunds/support burden.
- [ ] Every counted transfer corroborated by provider + onchain evidence, no self-volume.
- [ ] No live payments without separate explicit approval.

## Metrics
Trial-to-quote completion, quote latency P50/P95, quote error %, successful auth/session %, price acceptance, opted-in leads, payer retention, true settled transfers, independent payer count, failed/refunded transfers, sponsor-confirmed eligible volume, true net integrator revenue after operating costs.

## Stop conditions
Partner terms unclear, sanctions or business legitimacy concerns, unsupported mint, unconfirmed quote fees, wallet address mismatch, UX misrepresents test quotes as final prices, no reliable idempotency/receipt, inability to refund/reconcile, missing compliance owner, or any attempt to artificially drive competition volume.

## Outreach copy
Subject: Would a mobile Solana payout quote and receipt workflow help your business?

I'm working on a consent-first tool for businesses that already pay creators or contractors in Solana tokens. We're testing *quotes and payment status only* right now — no wallet keys or live funds. Would you be open to a 10-minute discussion about your actual payout workflow and whether the published transaction costs would make sense? No commitment or wallet connection is needed.

## Next owner decisions
Accept/decline the commercial model after sponsor reply, approve private preview access with a legitimate test key, and independently authorize any eventual production integration or recruitment campaign.

# MEME-VENTURE.01–.08 — Token Launch Services

Research-only delivery record, October 15, 2026. GitHub issue: https://github.com/bookieandco/crispy-waddle/issues/1311

**Product doctrine:** original, transparent, noncustodial token-creation *preparation service*. No buying bots, copied branding, investor promises, wallet connection, token issuance, trading, liquidity withdrawal, payment, contact scraping or autonomous publication. Nothing here is deployed or has earned a verified dollar.

## .01 — Source evidence and provenance

All repositories were read on 2026-10-15; none was executed, security-audited or accepted as commercial demand evidence.

| Repository | Observed implementation | Reuse judgment | License |
| --- | --- | --- | --- |
| https://github.com/metadev-xi/Memecoin-Launchpad-Platform | README + bondingCurveModel.js only; pricing, burns and fractional exponent need correction | Mathematical reference only | README claims MIT; LICENSE absent from observed root, copying not approved |
| https://github.com/techleadhd/memecoin-maker | Mainnet Solana mint example; keygen.js embeds private key and writes plaintext keypair.json | Read-only reference, never run with owner wallet | package declares MIT; review full grant before any reuse |
| https://github.com/rtb-12/MemeCoin | Solidity TokenFactory + frontend; no TRADING transition found; withdraw balances not decremented | EVM concept only, unsafe to deploy | MIT LICENSE present |

Promotional videos' profit numbers, artificial-buying systems, 15% liquidity bonuses and creator claims have not been verified. Three code repositories are not three independent demand signals. Real market evidence must be sourced, timestamped, challenged and admitted through canonical Venture market-scout tools.

## .02 — Buyer hypothesis and economics

Potential buyer: independent creators needing original art, rights-aware metadata, an allocation preview and a documented handoff. Job: reduce setup complexity, not guarantee token performance. Nonbinding proposed tiers: $49 brand preview or $149 creation preparation. Labor, cost, refunds, compliance and actual willingness-to-pay remain hypotheses; no collected payments exist. Disconfirming scenarios: preference for free tools, weak demand, excessive legal costs and low trust.

## .03 — Governance, originality, and Make It Make Sense

Draft review requires creator self-attestation for artwork rights, original branding, truthful promotion, disclosed liquidity and founder allocations, no artificial volume and no return guarantees. It blocks a mock preview when attestations fail, but an accepted attestation never certifies ownership, compliance or safety.

MAKE IT MAKE SENSE research vote: technical service preparation is coherent; customer demand is unproven; investor-harm and custody exposures are material. Result: **prototype makes sense, business launch is HOLD**. Independent jurisdiction-specific legal review and IP verification are mandatory. No blanket securities or licensing exemption is claimed.

## .04 — Canonical ownership

Opportunity Core → Side Hustle Business Factory → Venture Lab (software_apps; creator_monetization adjacency) → canonical Side Hustle experiment → Outcome Learning. Existing opportunity-scout seed: token-creation-services-market. Builder owns mock studio; Director may later create approved original creative; Growth/Social later handle *authorized* marketing; SHARK only observes public market launches; Money/Coffer receives real receipts and governs cash; Action Core alone governs irreversible external actions.

The Studio creates **no** alternate authorization route, database, API, key-storage system, token issuer or payment rail. Candidate is research_candidate, unvalidated, OPPORTUNITY_ONLY; no research admission or production record is fabricated.

## .05 — Paper liquidity simulator

An independent deterministic constant-product AMM model takes assumed token and SOL reserves and a 0–1000-bps fee. For each hypothetical buy or sell: effective input = input × (1 − fee/10000); output = reserveOut × effectiveInput / (reserveIn + effectiveInput). The full incoming amount, including fee, stays in the reserve. It emits numbered, previous-linked **hypothetical** event receipts, never on-chain transaction IDs or realized revenue. No exchange, signer, wallet, withdrawal, bot or pricing oracle is present. This floating-point simulator is *not* safe for smart-contract arithmetic, MEV assessment, or live execution.

## .06 — Mobile Token Creator Studio

New route: /opportunity/token-creator, linked from Side Hustle Business Factory. Users can edit original mock branding, ticker, supply, allocation and rights checklist; calculate hypothetical service quotes; run a two-event paper AMM scenario; and view the proposed demand test. No server calls, persistent user orders, transactions or uploaded files.

## .07 — Bounded demand-test proposal

Local helper proposes at most seven days, $0 spending, an approved owned landing-page channel and at least five genuine, independently verified prospect responses. Proposed success measures: five qualified independent responses and at least two explicit nonbinding interest signals. Kill for IP issues, invalid offers, weak response, poor margin, or regulatory uncertainty. This proposal is **not** experiment admission: no page was published, no outreach made, no responses observed, and no outcome scored. Existing Side Hustle Lab / Action Core must separately approve and evidence those steps.

## .08 — Finance truth and go/no-go

Five review inputs: independent legal clearance, independent security assessment, five verified demand receipts, at least one Money-reconciled commercial receipt, and separate Action Core commissioning. These are *external* checks; self-asserted booleans do not prove them. Even if all turn true, the helper returns READY_FOR_SEPARATE_AUTHORITY_REVIEW, never authorization to launch or spend. The simulated/proposed price, margins, and fees cannot be recorded as sales.

**Currently blocked by missing real-world evidence:** customer demand, legal/IP clearance, independent security audit, production experiment, finance reconciliation, deployment and actual live outcome. Simulated revenue is $0 and no real payments or chain operations occurred.

## Acceptance / testing

New module: packages/opportunity-core/src/domain/meme-venture.ts.
Assertions: packages/opportunity-core/src/domain/meme-venture.test.ts; bound to Opportunity Core package test script.
Suggested checks:
- pnpm --filter @jhadina/opportunity-core exec tsx src/domain/meme-venture.test.ts
- pnpm --filter @jhadina/opportunity-core type-check
- pnpm --filter @jhadina/jhadina-web type-check
- Manually visit /opportunity/token-creator on iPhone and test missing confirmations, invalid ticker/percentages, scenario changes, and no wallet prompts.

**Hard criteria:** No private-key entry, RPC, transaction transport, wallet connection, artificial-trade promotion, real liquidity removal, auto-publication, trade orders, payment endpoint, independent finance authority or copied code from references. Software test success must not be reported as live business validation.

Next dependencies: gather genuine external buyer signals; qualify legal/IP/security review; canonical research and bounded experiment approvals; real prospect evidence; optional authorized customer sales and Money-reconciled receipts. No purchases or spending authorized.

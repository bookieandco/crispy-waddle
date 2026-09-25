# SAM Operating System — folded contracting lessons

Status: implementation on \`agent/sam-fold-all-lessons\`.

## Purpose

This layer folds the recent contracting/subcontracting study material into the existing Opportunity Core SAM stack without creating a second procurement authority.

Existing modules remain authoritative for their current responsibilities:

- SAM discovery and source ingestion
- provider evidence, verification, qualification, freshness, brokerage and matching
- fulfillment plans and subcontractability
- provider outreach/negotiation
- contract readiness, drafting and execution receipts
- provider quotes and quote normalization
- solicitation intelligence and proposal assembly
- award-to-execution handoff and contractor performance
- SBA SUBNet discovery

The new operating layer connects those pieces into one evidence-governed lifecycle:

\`discover -> capture -> qualify -> source -> price -> fund -> propose -> human submit -> award -> onboard -> perform -> accept -> invoice -> collect/pay -> learn\`.

## Authority boundary

The folded SAM layer is intelligence and preparation only.

It never grants:

- automatic provider outreach
- bid submission authority
- contract signature/execution authority
- borrowing/credit-draw authority
- payment authority
- autonomous provider selection

All terminal actions remain human governed.

## 1. Capture and notice lifecycle

SAM now models notice maturity separately from capture value.

Sources Sought and presolicitation notices can be high-value capture signals while still not being award-stage opportunities.

Canonical lifecycle:

1. discovery
2. Sources Sought / market research
3. presolicitation
4. solicitation
5. amendment
6. award
7. execution
8. closeout

Advanced saved-search context can retain notice types, NAICS, PSC, agency, office, set-aside, geography, keywords, posted/response windows, active state and value ranges.

Notice versions preserve digest/source/version lineage so amendments can supersede earlier evidence instead of silently replacing it.

## 2. Buying office, incumbent and historical relationships

Capture context can retain:

- buying office observations
- historical contract number/value/period
- incumbent evidence
- prior NAICS/PSC
- confirmed or potential historical provider relationships
- contract-vehicle evidence

Historical records are evidence for comparison and provider discovery. They do not prove current price, capacity, subcontract status, or eligibility.

Potential provider relationships remain explicitly inferred unless supported by direct evidence.

## 3. Sources Sought response schema

A Sources Sought notice is parsed for the response actually requested, such as:

- company identity
- UEI/CAGE
- socioeconomic status
- capability
- relevant experience
- pricing when requested
- staffing/technical information
- contract-vehicle information
- page/file-size/submission constraints

Pricing is not assumed to be required for every Sources Sought response.

## 4. Site-visit intelligence

Site visits retain:

- required/optional state
- date/location
- registration deadline
- attendance rules
- question deadline
- attendee-list availability/evidence
- provider participants

Published attendee information may be used as discovery evidence, but attendance never proves provider suitability.

## 5. Provider bench and discovery provenance

Provider sourcing uses a configurable candidate target (default five) instead of a universal hard requirement.

Bench states:

- \`COVERAGE_HEALTHY\`
- \`MARKET_CONSTRAINED\`
- \`DISCOVERY_INCOMPLETE\`

Discovery provenance distinguishes government/award evidence from weaker discovery channels such as web search, professional networks, public business social pages, marketplaces, referrals, site-visit attendee information and owner-added contacts.

Weaker discovery channels require corroboration before provider readiness.

## 6. Referrals and provider relationship continuity

Provider referrals retain who referred whom, the requirement, timing and evidence.

Communication preferences are learned per provider and contact. No geographic or demographic communication stereotypes are encoded.

Long procurement cycles can be evaluated for:

- quote validity
- current commercial contact
- capacity reconfirmation
- replacement-contact need

Result:

- \`QUOTE_CONTINUITY_OK\`
- \`RECONFIRM_PROVIDER\`

## 7. Price-evidence taxonomy and quote confidence

Pricing evidence remains typed:

- \`FIRM_VENDOR_QUOTE\`
- \`BUDGETARY_VENDOR_QUOTE\`
- \`WRITTEN_ESTIMATE\`
- \`PAID_EXPERT_ESTIMATE\`
- \`HISTORICAL_AWARD_COMPARABLE\`
- \`CATALOG_OR_RATE_CARD\`
- \`MODEL_ONLY_ESTIMATE\`

Model-only pricing cannot certify provider pricing.

Quote coverage reports usable observations, vendor observations, historical comparables and confidence.

## 8. Solicitation pricing intelligence

The new pricing model supports:

- hourly
- daily
- monthly
- unit
- lot
- fixed-price
- cost-reimbursement
- mixed pricing

Evaluation methods include:

- price only
- LPTA
- best-value tradeoff
- technical/price tradeoff
- qualifications based
- other

Pricing periods are explicit so base periods, option periods and extensions are not flattened into one guaranteed value.

Escalation assumptions retain their basis/evidence and are not silently hard-coded.

## 9. Wage/labor-classification candidates

Labor classifications retain:

- code/title
- base wage
- fringe
- source reference
- duty-match evidence
- confidence
- verified state

Semantic similarity may propose a classification but cannot make it legally/factually verified without evidence/review.

## 10. Solicitation conflict detection

Material conflicts can be recorded between:

- pricing instructions and price tables
- SAM listing and solicitation period
- SOW/PWS and instructions
- evaluation language
- attachment versions
- submission rules

A high-materiality unresolved clarification blocks proposal readiness rather than being guessed away.

## 11. Federal cost build

Pricing scenarios separate:

- labor
- provider/subcontract cost
- materials
- logistics
- overhead
- contingency
- financing cost

Strategies can be modeled as:

- self-perform
- prime with subcontractor
- teaming
- hybrid

Profit and margin are calculated after financing cost.

## 12. Working-capital and contract-finance readiness

Cash-flow events model timing of:

- provider payments
- material purchases
- shipping
- taxes/fees
- payroll
- mobilization
- bonds/insurance
- government receipts

The system calculates peak pre-receipt cash need.

Available business cash is reduced by protected reserve before it is treated as usable execution capital.

Funding facilities can represent:

- existing business cash
- supplier terms
- business LOC
- business loan
- receivables finance
- accelerated payment
- credit card
- private financing
- personal capital

A facility must have evidence and be available early enough to bridge the actual cash gap.

Later-stage receivables financing cannot solve a pre-delivery cash requirement merely because it may eventually exist.

Personal/high-risk capital remains an explicit category rather than a default recommendation.

## 13. Requirement-to-response proposal traceability

Every mandatory solicitation requirement can retain:

\`source -> requirement -> evaluation factor -> proposal response -> supporting evidence -> claim type\`.

Proposal claim kinds:

- solicitation fact
- prime verified fact
- team-member verified fact
- quote fact
- modeled assumption
- unsupported

Mandatory unsupported claims block submission readiness.

This layer strengthens, rather than replaces, the existing ProposalPackage completeness check.

## 14. Provider-specific scope packets

Provider work can be reduced into an evidence-linked scope packet containing the tasks, quantities, location, schedule, standards, required credentials, government/provider furnished items, site-visit context, quote deadline, assumptions, questions and source evidence.

The summary never replaces the underlying solicitation source.

## 15. Prime-to-subcontractor sales lane

SAM now explicitly supports the opposite commercial direction:

\`government -> established prime -> us as subcontractor\`.

The Prime Account/relationship context supports:

- agency/NAICS alignment
- active award evidence
- supplier portal
- introductions
- vendor registration
- capability statement
- meetings
- RFQs
- quotes
- subcontract offers/signatures
- work start
- invoices
- payments
- renewals/referrals

SBA SUBNet remains the existing discovery adapter; the relationship layer handles what happens after discovery.

Payment terms are required for a subcontract opportunity to become commercially clear.

Staffing/training fulfillment should continue to reuse Staffing Core rather than duplicate workforce records inside SAM.

## 16. Award-to-execution subcontractor onboarding

Provider states are deliberately separated:

- \`PROVIDER_IDENTIFIED\`
- \`PROVIDER_CONTRACTED\`
- \`PROVIDER_READY_FOR_PERFORMANCE\`

Provider onboarding can require, as applicable:

- executed subcontract
- confidentiality-document status
- tax-documentation rule review/completion
- written payment terms
- PO/work authorization
- scope expectations
- quality-control criteria
- site-access readiness
- communication profile
- acceptance criteria
- compliance evidence
- backup providers

No universal rule says every subcontractor always needs the same NDA/tax form; contract, tax and compliance rules control.

## 17. Purchase orders/work authorization

Provider POs bind:

- provider
- subcontract
- scope
- amount/currency
- period/location
- payment terms
- evidence
- change-order requirement

A PO never grants automatic payment authority.

## 18. Kickoff, communication and change control

Post-award context supports:

- government/provider contacts
- roles/responsibilities
- schedule
- locations
- access requirements
- communications cadence
- escalation path
- invoice instructions
- acceptance process
- change-control rules

Government/client communications remain separate from provider communications.

Change orders retain scope, cost, schedule and authorization evidence before implementation.

## 19. Acceptance before invoice eligibility

Government acceptance records distinguish:

- accepted
- accepted with exceptions
- rejected

Provider completion is not treated as government acceptance.

Acceptance records can support invoice eligibility when the award terms require it.

## 20. Federal invoice lifecycle

Contract invoices can move through:

- DRAFT
- READY_FOR_REVIEW
- AUTHORIZED_FOR_SUBMISSION
- SUBMITTED
- ACCEPTED
- REJECTED
- RESUBMITTED
- PAID
- OVERDUE

Invoice method is extracted from the actual contract/award; the SAM layer does not assume one federal payment system.

## 21. Unified readiness

The canonical operating certification separates pre-award and post-award readiness.

Pre-award can reach:

\`READY_FOR_HUMAN_SUBMISSION_REVIEW\`

only when proposal, pricing, quote coverage and funding gates are acceptable.

After an award, provider onboarding must reach:

\`PROVIDER_READY_FOR_PERFORMANCE\`

before the system represents the provider as operationally ready.

Even at those states:

- outreach authorization remains false
- bid submission authorization remains false
- contract execution authorization remains false
- payment authorization remains false

until the existing human/policy action path authorizes the specific action.

## Source handling

The training transcripts are treated as operational study material, not legal, tax, accounting or procurement authority.

Examples such as candidate-count targets, outreach cadence, financing methods, provider paperwork and escalation assumptions are modeled as configurable evidence/assumptions rather than universal rules.

Solicitation text, amendments, official award records, verified provider evidence and applicable policy remain controlling.

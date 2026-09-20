# SAM-PROD.25–29 — Live Fulfillment Activation

Date: 2026-09-20

## SAM-PROD.25 — Live pilot harness
Implemented a live pilot receipt binding the upstream notice reference to the canonical Opportunity reference, SAM live-certification result, provider research status, qualification/team metrics and persistence recovery result. It explicitly carries no outreach or bid-submission authority. A real deployed SAM request remains environment-gated by the server-side SAM_GOV_API_KEY; absence is environment_blocked, never fabricated success.

## SAM-PROD.26 — Provider source expansion
The canonical ProviderDiscoveryAdapter boundary supports entity-directory, award-history, workforce, local-business, web-search and manual evidence sources. Sources produce observations only; discovery cannot mark a provider verified.

## SAM-PROD.27 — Provider qualification
Added qualification over canonical provider matching, with hard checks for expired verified credentials and unavailable capacity. Unknown capacity remains review-required. NAICS similarity remains intelligence rather than proof.

## SAM-PROD.28 — Prime/sub team builder
Added a governed team candidate builder over non-blocked provider candidates. It reuses the canonical fulfillment planner and shortlist rather than creating a parallel SAM team model. Every plan requires human approval and has engagementAuthorized=false.

## SAM-PROD.29 — Quote workflow
Added an evidence-bound provider quote lifecycle: draft quote request → provider response receipt → accepted-for-model. Quotes bind opportunity, provider, assigned requirements and outreach packet. Expired quotes cannot enter modeling. Quote acceptance does not authorize a pricing commitment or payment.

## Production boundary
This tranche structures evidence needed to determine whether providers can plausibly fulfill a SAM requirement and what fulfillment may cost. It does not authorize provider contact, bid submission, signature, contract execution or payment.

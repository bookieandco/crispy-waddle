# Cross-Border Provider Corroboration

## Purpose

Mexico and Canada are official provider-discovery lanes in the SAM fulfillment
pipeline, but a single directory record is not enough to establish a usable
supplier.

This layer adds bounded web/company corroboration after an official foreign
source has found a provider.

## Mexico

Primary source: INEGI DENUE.

DENUE establishes that the establishment appears in the official Mexican
business directory and provides business/legal name, economic activity, size
band, location and available contact/site information.

General-company search may then target Mexico using Exa, but the web result:

- does not set or verify country;
- does not convert SCIAN into U.S. NAICS;
- does not establish legal standing, capacity, origin, eligibility or pricing.

When DENUE and a web result expose the same company website domain, the runtime
may merge the evidence even when the page title uses a trade name rather than
the DENUE legal name. No fuzzy-name merge is used.

## Canada

Primary sources:

- ISED Canadian Importers Database for historical product/import evidence;
- Statistics Canada Open Database of Businesses for named-business/NAICS
  evidence when a controlled cached catalog is configured.

General-company search may then target Canada. Canada uses NAICS, so NAICS terms
may be used as search language, but web search still does not independently
verify Canadian domicile or classification.

## Evidence and status

Official foreign source + web discovery are two distinct provenance types, but
that does not bypass the foreign-provider gate.

Every Mexico/Canada provider still passes through:

1. solicitation-specific subcontractability analysis;
2. nationality/place-of-performance restrictions;
3. domestic-source and country-of-origin rules;
4. food/import/cold-chain requirements when applicable;
5. capacity and credential verification;
6. quote/commercial review;
7. human approval.

Foreign-provider evidence therefore remains at least `review_required` when
the subcontractability model returns its mandatory foreign-provider condition.

## Request budgets

- `EXA_SEARCH_BUDGET_PER_ENRICHMENT`: normal U.S. broad-company discovery.
- `EXA_FOREIGN_CORROBORATION_BUDGET_PER_ENRICHMENT`: additional Mexico/Canada
  corroboration, used only after an official foreign source returned results.

No search result authorizes outreach, bid submission, signature or payment.

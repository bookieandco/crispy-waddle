# SAM Provider Taxonomy and Identity Policy

## Purpose

This layer expands solicitation requirements into supplier-discovery language without weakening the evidence gates used by SAM-USABLE.FINAL.

Canonical flow:

1. solicitation requirement text
2. notice NAICS / PSC
3. NAICS -> SIC crosswalk aliases
4. industry-language and common supplier phrases
5. requirement-specific USAspending searches
6. active SAM Entity discovery / verification
7. provider-specific subcontractability evaluation
8. fulfillment-team construction
9. quote and commercial-readiness gate

## Taxonomy sources

### G30_SIC

Repository: https://github.com/bpluly/G30_SIC

The embedded NAICS/SIC crosswalk is generated from
`tabula-NAICS-to-SIC-Crosswalk.csv` and is distributed under the upstream
Apache-2.0 license. The upstream license is retained at
`third_party/licenses/G30_SIC_LICENSE.txt`.

The crosswalk is used only for search expansion. A SIC match is not treated as
proof that a provider can satisfy a solicitation.

### sic4-list

Repository: https://github.com/saintsjd/sic4-list

Useful as a reference list for four-digit U.S. SIC descriptions, but the
repository declares no license. Its data is therefore not copied into Jhadina.

### User-supplied business-category vocabulary

The supplied gist/category references are useful for expanding human business
phrasing such as distributor, wholesaler, carrier, cold storage, and specialty
contractor. They are reference material only unless a compatible license is
established.

### FederalFiling search guidance

FederalFiling is treated as workflow guidance rather than an authoritative data
source. The provider search engine follows the useful pattern of trying several
valid procurement-language paths: NAICS, PSC, prior-award descriptions,
industry terminology, and common alternate supplier phrases.

## Official procurement / identity sources

### USDA small-business guidance

USDA's "Getting Started as a Government Contractor" page reinforces that NAICS
classification, SBA size standards, set-aside status, and SAM registration are
important government-contracting signals.

This guidance is not converted into a universal rule that every subcontractor
must be SAM-registered. Solicitation terms and applicable FAR/SBA rules remain
controlling. For set-aside analysis, Jhadina may use the NAICS-level
`sbaSmallBusiness` indicator returned by the sanctioned SAM Entity API as
evidence requiring solicitation-specific review.

Source:
https://www.usda.gov/about-usda/general-information/initiatives-and-highlighted-programs/small-business/getting-started-government-contractor

### SAM Entity Management API

The sanctioned SAM Entity API is the automated identity source for:

- UEI
- CAGE
- active registration status
- registration purpose
- physical country
- NAICS
- PSC
- NAICS-level SBA small-business indicators

Public-sensitivity data only is requested by this runtime.

Source:
https://open.gsa.gov/api/entity-api/

### DLA CAGE

The DLA CAGE site is a monitored U.S. Government information system with usage
conditions. Jhadina must not scrape or automate the interactive DLA CAGE site.

CAGE codes used by the automated provider runtime are obtained from the
sanctioned SAM Entity API. Direct DLA CAGE lookup remains a manual verification
surface when a human needs to inspect the authoritative CAGE interface.

Source:
https://cage.dla.mil/Home/UsageAgree

## Evidence rules

- Multiple records from one source do not constitute multi-source verification.
- A provider reaches the normal `candidate` state only when corroborated by at
  least two distinct source types and the capability score is sufficient.
- A provider can remain `review_required` with strong award history but only
  one source type.
- USA / US / United States country variants are normalized as domestic.
- Foreign providers are not automatically rejected. They are passed into the
  solicitation-specific subcontractability and product-origin gate.
- CAGE is an identity attribute, not proof of capability.
- SAM registration is evidence, not a substitute for capacity, pricing,
  geography, licensing, insurance, food-safety, origin, or performance proof.
- No provider discovery result authorizes outreach, bid submission, contract
  signature, or payment.

## Search budgets

Provider expansion intentionally has bounded request budgets:

- `SAM_ENTITY_REQUEST_BUDGET_PER_ENRICHMENT`
- `USASPENDING_REQUEST_BUDGET_PER_ENRICHMENT`

The budgets protect low-quota API keys and keep enrichment bounded. Exhausting a
budget creates incomplete discovery evidence; it must never be represented as
proof that no other providers exist.

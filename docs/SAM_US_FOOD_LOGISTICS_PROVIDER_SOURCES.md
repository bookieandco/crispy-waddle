# U.S. Food and Logistics Provider Sources

## Purpose

These sources broaden U.S. fulfillment-company discovery beyond federal award
history. They provide capability and identity evidence for food processing and
transport/logistics requirements without changing SAM-USABLE.FINAL authority
boundaries.

A directory or regulatory record is discovery evidence. It is not, by itself,
proof that the business can meet a particular solicitation's quantity,
schedule, price, insurance, licensing, product-origin, or subcontracting terms.

## FMCSA Company Census File

Official source:
https://catalog.data.gov/dataset/company-census-file

Official API:
https://data.transportation.gov/resource/az4n-8mr2.json

FMCSA publishes regulated-entity census information including USDOT number,
legal/DBA name, operating characteristics, company status, location, contacts,
fleet/driver counts, cargo types, and related carrier information. FMCSA states
that the Company Census File is updated daily from a roughly 24-hour-old
database.

Jhadina uses this source only when a requirement indicates transportation or
cargo capability such as:

- refrigerated/cold-chain food;
- meat;
- produce;
- beverages;
- grain/feed;
- general freight/logistics/distribution.

The runtime filters to active U.S.-domiciled entities and stores the source as
`fmcsa_carrier`.

### FMCSA safety boundary

FMCSA census, SMS, inspection, or rating data must not be converted into an
unsupported independent claim that a carrier is "safe", "unsafe", "fit", or
"unfit".

The current source records carrier identity/capability facts and any published
rating field as informational evidence only. Formal operating authority,
out-of-service orders, insurance requirements, and solicitation-specific
transport requirements require separate review when material.

An FMCSA-only result remains `review_required` until corroborated.

## USDA FSIS Meat, Poultry and Egg Product Inspection Directory

Official source:
https://www.fsis.usda.gov/inspection/establishments/meat-poultry-and-egg-product-inspection-directory

Data.gov directory:
https://catalog.data.gov/dataset/fsis-mpi-meat-poultry-and-egg-inspection-directory-by-establishment-name

USDA FSIS states that the MPI Directory lists establishments producing
FSIS-regulated meat, poultry, and egg products. The companion Establishment
Demographic Data includes establishment size, slaughter species, and processing
activities such as raw intact, raw non-intact, ready-to-eat, and not-ready-to-eat.
FSIS publishes these datasets as public CSV files and updates the directory
regularly.

Jhadina uses FSIS only for relevant meat/poultry/egg requirements.

The runtime intentionally does not scrape the interactive USDA page. Direct
official CSV URLs are configured server-side with:

- `FSIS_MPI_CSV_URL`
- `FSIS_MPI_DEMOGRAPHIC_CSV_URL`

A separate catalog refresh process may later own these URLs if USDA changes the
download paths.

The source is stored as `fsis_establishment`.

An FSIS establishment record proves federal inspection-directory presence and
reported activity categories. It does not prove product-specific availability,
capacity, pricing, schedule, or contract eligibility.

## USDA PACA

Official licensing page:
https://www.ams.usda.gov/rules-regulations/paca/licensing

PACA licensing is useful for identifying or verifying businesses dealing in
fresh and frozen fruits and vegetables, including wholesalers, processors,
truckers, grocery wholesalers, and food-service firms when the statutory
thresholds apply.

No sanctioned machine-readable PACA bulk/API endpoint has been established in
the current implementation.

Therefore:

- the interactive PACA license search is **not scraped**;
- PACA remains a manual verification surface;
- no `paca_license` evidence is generated automatically until an official
  reusable data interface is verified.

## Evidence rules

- `fmcsa_carrier` and `fsis_establishment` are independent source types.
- A single source does not satisfy normal multi-source provider verification.
- A provider still passes solicitation-specific subcontractability, domestic
  source/product-origin, licensing, insurance, capacity, quote, and commercial
  review.
- Regulatory/directory presence is not a substitute for provider capacity.
- No provider discovery result authorizes outreach, quote submission, bid
  submission, contract signature, or payment.

## Runtime budgets

- `FMCSA_SEARCH_BUDGET_PER_ENRICHMENT`
- `FSIS_SEARCH_BUDGET_PER_ENRICHMENT`

Budgets keep enrichment bounded. Exhausting a budget means discovery is
incomplete; it must never be represented as proof that no other provider exists.

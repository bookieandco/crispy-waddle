# Mexico and Canada Provider Sources

## Purpose

These sources broaden Jhadina's fulfillment-company discovery beyond U.S.
federal award history without weakening the evidence threshold used by
SAM-USABLE.FINAL.

They are **provider discovery evidence**, not authorization to subcontract with
a foreign company.

Every Mexican or Canadian company still passes through:

1. solicitation-specific subcontractability analysis;
2. domestic-source / country-of-origin review where applicable;
3. product-origin rules for supply and food contracts;
4. provider capability and capacity review;
5. quote/commercial review;
6. human approval before any outreach, bid, signature, or payment.

## Mexico — INEGI DENUE

Official source:
https://www.inegi.org.mx/servicios/api_denue.html

DENUE is operated by Mexico's INEGI and exposes establishment identity,
business/legal name, economic activity, employee-size band, location, phone,
email, website, and coordinates for millions of establishments.

Runtime behavior:

- uses the documented `BuscarEntidad` method;
- uses entity code `00` for nationwide searches;
- uses a small bounded result window;
- requires the server-only `INEGI_DENUE_TOKEN`;
- never stores or exposes the token in evidence;
- stores the source as `denue`;
- records DENUE/SCIAN activity text but **does not pretend SCIAN is U.S. NAICS**.

A DENUE-only result remains `review_required`. It needs independent evidence
before it can satisfy the normal multi-source provider gate.

## Canada — Canadian Importers Database

Official source:
https://open.canada.ca/data/en/dataset/2e7c5a58-986f-402c-9dec-a45e0dadf8dd

Publisher: Innovation, Science and Economic Development Canada (ISED).

Licence: Open Government Licence - Canada.

The Canadian Importers Database provides lists of companies importing goods
into Canada by HS6/HS10 and other views.

Runtime behavior:

- matches requirement language to the official HS6 description vocabulary;
- prefers ISED's current public product report for the matched HS6 code;
- current product reports expose named major Canadian importers and their
  published data year (currently 2024);
- uses the official 2022 CSV importer release only as a machine-readable
  historical fallback when the current report returns no named importers;
- stores both forms as `canada_importer` evidence while recording the actual
  dataset year and evidence role;
- keeps `currentCapability: review_required`.

The importer database is trade/import evidence, not proof that the company has
stock, capacity, can meet the contract schedule, or is eligible under a U.S.
solicitation.

## Canada — Statistics Canada Open Database of Businesses

Official source:
https://www150.statcan.gc.ca/n1/pub/21-26-0003/212600032023001-eng.htm

Bulk download:
https://www150.statcan.gc.ca/n1/pub/21-26-0003/2023001/ODBus_2023.zip

Licence: Open Government Licence - Canada.

ODBus includes names, addresses, industry information/NAICS when supplied,
status, municipality/province, and other characteristics for a selection of
Canadian businesses. Statistics Canada explicitly states that ODBus is not a
complete list of Canadian businesses and is separate from the Business
Register.

The provider adapter can query a cached/pre-extracted CSV using
`CANADA_ODBUS_CSV_URL`.

The ~450,000-row bulk archive is **not downloaded during every SAM enrichment**.
A separate catalog/import worker should own bulk refreshes.

## Evidence rules

- `denue`, `canada_importer`, and `canada_odbusiness` are distinct source
  types.
- One foreign directory source is never enough for normal `candidate` status.
- Two independent sources can satisfy the provenance count, but foreign-provider
  subcontractability/origin review can still downgrade or block the provider.
- Directory presence is identity/capability-discovery evidence, not proof of
  capacity, insurance, licences, food-safety compliance, product origin,
  pricing, or schedule availability.
- No source authorizes outreach, quote submission, bid submission, signature,
  or payment.

# LOCAL-GOV.5F — Authoritative .gov Source Bootstrap

## Purpose

Remove the production dependency on a paid web-search provider for basic public-buyer source discovery.

## Authoritative registry

The worker uses CISA's public .gov registry dataset:

- source: https://raw.githubusercontent.com/cisagov/dotgov-data/main/current-full.csv
- publication owner: get.gov / CISA
- refresh cadence: published daily upstream; Jhadina refreshes when the local copy is older than 24 hours.

The registry identifies official .gov domains by domain type, organization, city and state.

## Separation of facts

A registered .gov domain means the domain belongs to an eligible government organization.

It does **not** mean:

- the homepage itself is a procurement source;
- every link is an active solicitation;
- the organization currently has work available;
- an award exists;
- a company is qualified or willing to subcontract.

Those require later evidence.

## Jurisdiction matching

Registry domains can match:

- state;
- county;
- city;
- school district;
- special district.

Matching requires compatible jurisdiction class + state and a high-confidence organization-name match.

Registry special districts that are not already in the Census-derived graph are created as explicit `special_district` jurisdictions with Get.gov provenance. This expands coverage but does not claim that the .gov registry is a complete census of every special district.

## Procurement-source discovery

For matched domains:

1. fetch the verified .gov homepage;
2. identify procurement/purchasing/bid/RFP/award/vendor/public-works links;
3. follow a bounded number of first-party procurement links;
4. identify deeper award/solicitation/vendor links;
5. treat linked third-party portals as verified only because the official government page linked to them;
6. persist source provenance and verification evidence.

Search providers remain an optional fallback when first-party domain discovery produces no verified source.

## Production throughput

When no paid search provider is configured, the commissioner uses larger zero-key batches and bounded concurrency.

Source discovery still remains read-only and grants no authority to:

- contact buyers;
- contact primes;
- contact providers;
- submit bids;
- execute contracts;
- move funds.
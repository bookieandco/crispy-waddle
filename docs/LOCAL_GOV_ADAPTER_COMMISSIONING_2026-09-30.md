# LOCAL-GOV.4 — Read-Only Adapter Commissioning

## Purpose

Turn verified procurement sources from LOCAL-GOV.3 into certified read-only ingestion adapters without letting a single successful scrape silently become production truth.

## Adapter classes

### Generic native-government templates

Verified public-government sources can enter shadow parsing through:

- `generic-html-table-v1`
- `generic-rss-atom-v1`
- `generic-json-collection-v1`

The parsers normalize discovered records into canonical `PublicOpportunitySignal` rows while preserving source URL, stable external ID and evidence reference.

### Portal-specific templates

Common procurement platforms are fingerprinted separately:

- OpenGov
- PlanetBids
- BidNet Direct
- Bonfire
- Public Purchase
- IonWave
- DemandStar
- Periscope S2G
- Bids & Tenders

A verified portal is not automatically scraped by the generic adapters. It remains `PORTAL_TEMPLATE_REQUIRED` until a platform-specific read-only adapter or documented public feed is commissioned.

## Technical access admission

Native `.gov` pages receive a narrow read-only access review before shadow trials:

1. source must be officially verified;
2. source URL must be public HTTP(S);
3. source must be a native `.gov` host for generic automatic admission;
4. `robots.txt` must not disallow the source path.

This is a technical crawl-admission gate, not a claim that robots.txt is a complete legal/terms analysis.

Third-party platforms require explicit platform access review.

## Shadow trials

Each trial records:

- source;
- adapter key/version;
- observation timestamp;
- source-content digest;
- HTTP status;
- parse success;
- observation count;
- stable external-ID count;
- duplicate-ID count;
- provenance completeness;
- access-review state;
- error code;
- evidence references.

## Certification

Default activation requires at least **three** successful read-only shadow trials.

A source can become `ACTIVE_READ_ONLY` only when:

- the source is officially verified;
- access review is approved;
- at least 3 successful trials exist;
- successful trials produced observations;
- stable external-ID coverage is at least 95%;
- no duplicate external IDs were observed;
- provenance is complete.

Failures remain `SHADOW` or `BLOCKED`; they do not silently activate.

## Live ingestion

Once certified, the same worker can write normalized observations into the global `jhadina_public_opportunity_inbox`.

That still grants no authority to:

- contact a buyer;
- contact a provider;
- submit a bid;
- sign a contract;
- accept a contract;
- move money.

## Scheduler

`/api/internal/opportunities/public/adapter-shadow`

The existing GitHub OIDC scheduler invokes the worker hourly at minute 55, after source commissioning at minute 45.

## Next

- platform-specific read-only adapters for the highest-frequency portal families;
- awarded-prime miner and subcontract work-package compiler;
- state-specific compliance packs;
- production coverage metrics and LOCAL-GOV.FINAL certification.

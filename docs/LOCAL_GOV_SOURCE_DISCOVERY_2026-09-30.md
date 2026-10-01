# LOCAL-GOV.3 — National Procurement Source Commissioning

## Purpose

Turn the durable U.S. jurisdiction inventory from LOCAL-GOV.2 into a progressively verified procurement-source registry without treating search-engine results as trusted procurement authority.

## Trust model

`Jurisdiction -> bounded search -> candidate -> official owner corroboration -> official portal corroboration -> adapter required -> active`

A search result is discovery evidence only.

A source can become verified in one of two ways:

1. the result is an official government procurement/purchasing page that matches the target jurisdiction; or
2. an official government page links to a third-party procurement portal.

Known bid-platform domains are useful discovery signals, but they are not authoritative by themselves.

No source-discovery result can automatically activate an adapter, contact a buyer/vendor, submit a bid, sign a contract, or move money.

## Runtime

### Search providers

The commissioner reuses existing Jhadina search rails:

- `WEB_SEARCH_URL` + `WEB_SEARCH_API_KEY` when configured;
- `EXA_API_KEY` as the existing discovery-only fallback.

No new search vendor is introduced.

### Queue

`jhadina_public_source_discovery_jobs` gains:

- priority;
- attempt count;
- last error;
- candidate count;
- verified source count.

State jobs have higher initial priority than county jobs.

### Dynamic source registry

`jhadina_public_procurement_sources` records:

- jurisdiction;
- source URL/name;
- procurement source kinds;
- inferred adapter kind;
- discovery provider;
- verification status;
- official owner/backlink evidence;
- confidence;
- blockers;
- adapter status;
- discovered/verified/last-seen timestamps.

The table is service-role-only.

### Worker

`/api/internal/opportunities/public/source-discovery`

- uses the existing GitHub OIDC production scheduler boundary;
- processes a bounded queue batch;
- runs bounded queries per jurisdiction;
- fetches only official-government HTML pages for outbound-link corroboration;
- persists candidates and verified sources;
- leaves failures retryable.

Default limits:

- batch size: 12 jurisdictions per run;
- query budget: 2 searches per jurisdiction;
- source-page corroboration: first 4 official owner pages;
- linked candidates: maximum 25 links per owner page;
- commissioner concurrency: 3.

The scheduler runs the worker hourly at minute 45.

## Coverage progression

The source registry is intentionally independent of adapter activation.

A jurisdiction can be:

`pending -> discovered -> adapter_required -> active`

This allows Jhadina to establish trustworthy national source coverage before writing brittle parsers for every portal.

## Next

- LOCAL-GOV.4 — adapter-template commissioning for common public procurement platforms;
- LOCAL-GOV.5 — awarded-prime miner and subcontract package compiler;
- LOCAL-GOV.6 — state-specific compliance packs;
- LOCAL-GOV.FINAL — measured national source coverage and live end-to-end certification.

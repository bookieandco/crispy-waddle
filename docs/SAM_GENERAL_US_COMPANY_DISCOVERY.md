# General U.S. Company Discovery

## Purpose

Official government datasets are the preferred evidence sources for provider
identity and regulated capabilities, but many legitimate U.S. suppliers have no
federal award history and may not appear in a specialized source such as FSIS
or FMCSA.

This layer adds broad web/company discovery through Exa so Jhadina can discover
firms for service, construction, industrial, equipment, specialty, and other
requirements before official corroboration is available.

## Exa search

Current API:
https://api.exa.ai/search

Documentation:
https://exa.ai/docs/reference/search

Runtime configuration:

- `EXA_API_KEY`
- `EXA_SEARCH_BUDGET_PER_ENRICHMENT`

The runtime uses a bounded `POST /search` request with `type: auto`,
`numResults`, and highlighted result content.

## Evidence boundary

Exa is a **discovery-only** source.

A search result does not establish:

- U.S. domicile;
- legal entity identity or good standing;
- SAM registration;
- UEI or CAGE;
- NAICS classification;
- licensing or certification;
- capacity;
- insurance;
- pricing;
- subcontracting eligibility;
- product origin;
- current availability.

For this reason the adapter intentionally leaves `country` undefined and does
not copy query NAICS codes into the candidate's verified NAICS list.

The source is recorded as `web_search`, with evidence flags stating that
country, identity, and NAICS remain unverified.

A web-only result therefore remains `review_required`. It must be corroborated
by an independent source such as SAM Entity, USAspending, FMCSA, FSIS, a
sanctioned state/entity registry, or other verified evidence before it can
satisfy the normal multi-source provider gate.

## Authority

Web discovery never authorizes:

- provider outreach;
- quote submission;
- bid submission;
- contract signature;
- payment.

Those remain human-governed actions after solicitation-specific compliance,
provider verification, and commercial review.

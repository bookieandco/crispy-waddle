# LOCAL-GOV.2 — Live Public Opportunity Runtime

## Production shape

LOCAL-GOV.2 extends the merged LOCAL-GOV.1 domain foundation with two protected production workers and one authenticated adoption surface.

### Daily jurisdiction refresh

`/api/internal/opportunities/public/jurisdictions`

- authenticated only by the existing Jhadina production-scheduler GitHub OIDC boundary;
- loads the U.S. Census Bureau 2026 county/county-equivalent Gazetteer files for all 50 states + DC;
- fails the refresh when any state/DC file is missing or the national catalog is implausibly incomplete;
- persists state and county/county-equivalent geography into a service-role-only table;
- seeds a source-discovery job for each jurisdiction without inventing procurement URLs.

### Frequent reference procurement scan

`/api/internal/opportunities/public/scan`

- starts with the official Los Angeles County ISD Open Master Agreements source;
- fetches the current official page;
- parses solicitation number, title, open date, close date, and detail URL;
- normalizes each record into `PublicOpportunitySignal` and canonical `Opportunity`;
- records source health/checkpoint state;
- fails closed when the expected source structure disappears;
- writes observations into the global public-opportunity inbox.

The source-health ladder is `healthy -> degraded -> failed`; three consecutive failures produce `failed`.

### Authenticated inbox/adoption

`/api/opportunities/public`

- GET lists global discoveries after user authentication;
- POST adopts one discovery into that user's existing canonical Opportunity repository;
- adoption does not grant external action authority.

The background scheduler never invents a user ID and never writes directly into user-owned Opportunity rows.

## Durable tables

- `jhadina_public_jurisdictions`
- `jhadina_public_source_discovery_jobs`
- `jhadina_public_opportunity_inbox`
- `jhadina_public_source_state`

All four are RLS-enabled and inaccessible to `anon` and `authenticated` roles. The server-side service role owns background persistence.

## Current official reference sources

- U.S. Census Bureau 2026 Gazetteer county/county-equivalent files.
- Los Angeles County Doing Business / ISD Open Master Agreements.

California / Los Angeles remains the reference adapter family. The national jurisdiction catalog exists specifically so subsequent LOCAL-GOV slices can discover and commission official state/county/city/school/special-district procurement sources without hard-coded guesses.

## Scheduler

The existing `.github/workflows/jhadina-production-scheduler.yml` now adds:

- every 4 hours: `local-gov-reference-scan`;
- daily: `local-gov-jurisdiction-refresh`.

No new scheduler, credential store, user identity mechanism, external action authority, bid submission authority, contract authority, or payment authority is introduced.

## Next

- LOCAL-GOV.3: source-discovery commissioning across every state/county job;
- LOCAL-GOV.4: California procurement adapters beyond the LA reference page;
- LOCAL-GOV.5: awarded-prime miner + subcontract work-package compiler;
- LOCAL-GOV.6: state-specific compliance packs;
- LOCAL-GOV.FINAL: production evidence and coverage certification.

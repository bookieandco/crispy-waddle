# TSavo Printify MCP audit for PupsonStuff

Reference repository: `TSavo/printify-mcp`  
Pinned audit revision: `951287b470c2d351e5a8cfd862d1d0ef3a6bf9c4`  
License: ISC

## Decision

Use this repository as an **operator-interface and compatibility reference**, not
as PupsonStuff's production fulfillment client.

The useful read-only tool surface maps cleanly to PupsonStuff's launch work:

- `get_printify_status`
- `list_shops`
- `get_blueprints`
- `get_blueprint`
- `get_print_providers`
- `get_variants`

PupsonStuff's canonical implementation remains `lib/printify.ts` and the
read-only `printify:sync` discovery script.

## Why the upstream MCP is not admitted directly

The upstream MCP also exposes mutation-capable tools including product create,
update, delete, publish, and image upload. Those capabilities are broader than
PS-RECON.8 catalog discovery needs.

More importantly, the audited upstream API client contains development fallbacks
that can return mock shops and mock/empty product data when a live Printify SDK
request fails. That behavior is unsuitable for production certification because a
provider outage or bad credential must never look like valid provider evidence.

PupsonStuff therefore keeps these guarantees:

1. missing `PRINTIFY_API_KEY` is a hard error;
2. non-2xx Printify responses throw `PrintifyApiError`;
3. no mock blueprint/provider/variant IDs can enter certification;
4. catalog discovery is read-only;
5. Supabase `pupson_catalog_variants` remains the only launch-certification
   ledger;
6. order creation remains behind PupsonStuff's existing fulfillment state machine
   and `PUPSON_FULFILLMENT_MODE=dry_run` until launch certification completes.

## Reuse plan

The MCP repository is still valuable for future Jhadina operator ergonomics. If a
Printify MCP surface is exposed inside Jhadina, it should be a PupsonStuff-owned
read-only wrapper around the canonical client above. Mutation tools should stay
disabled unless a separate governed workflow explicitly enables them.

The read-only GitHub workflow
`.github/workflows/pupsonstuff-printify-discovery.yml` is the current first step:
it needs only `PRINTIFY_API_KEY`, queries live catalog data, and uploads candidate
mapping reports without writing Supabase or mutating Printify.

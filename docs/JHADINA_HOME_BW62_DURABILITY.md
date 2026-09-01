# Jhadina Home B&W-6.2 Durability

## Status

**B&W-6.2 ingestion:** complete.

**B&W-6.2 durable persistence:** source implementation added; hosted verification pending.

## Supabase convention

The implementation follows the repository's current Jhadina convention: server-side privileged persistence uses the existing `service_role` client, tables enable RLS, and `anon` / `authenticated` receive no table privileges. The existing Memory Core migration uses this same service-role-only pattern while the application's real end-user identity boundary is being completed.

## Tables

### `public.jhadina_home_ingestion_idempotency`

- `event_id` primary key — database-level uniqueness across processes.
- `entity_id` records the source entity.
- `status` is `processing` or `completed`.
- `claimed_at`, `completed_at`, and `created_at` provide lifecycle timestamps.
- RLS is enabled.
- Access is restricted to `service_role`.

### `public.jhadina_home_entity_state`

- `entity_id` primary key — one canonical current snapshot per HA entity.
- canonical domain, friendly name, availability, and allowlisted attributes.
- Home Assistant provenance (`provider`, source entity, source event).
- `state_at` is the event ordering timestamp.
- `updated_at` records persistence time.
- correlation/causation metadata is retained.
- RLS is enabled.
- Access is restricted to `service_role`.

## Concurrency

`SupabaseHomeIdempotencyStore.claim()` uses the database uniqueness constraint so concurrent deliveries cannot both claim the same event.

`SupabaseHomeEntityStateStore.set()` uses compare-and-swap behavior: updates require the previously observed `state_at`; initial inserts rely on the entity primary key race to reject concurrent first writers.

## Event publication limitation

B&W-6.2 still has a deliberate transaction boundary:

1. durable state is committed;
2. the existing EventBus is published to;
3. idempotency is marked completed.

A publication failure releases the processing claim so a retry can attempt publication again. This is **not** full atomic state+event delivery. A future transactional outbox should close that gap before strict exactly-once delivery is required in production.

No second EventBus was introduced.

## Composition

`createProductionHomeStores()` uses the existing service-role Supabase client and fails closed when durable storage is unavailable. In-memory stores remain test/local implementations only.

B&W-6.3 should consume these stores through the existing ingestion pipeline rather than creating another persistence or policy layer.

## Verification

Local source/test verification of B&W-6.2 remains available through the existing `tsx --test` suite. Hosted GitHub Actions/Vercel verification remains blocked by the repository's current quota limitation and must be rerun when capacity is restored.

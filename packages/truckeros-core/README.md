# @jhadina/truckeros-core

Domain layer for TruckerOS: ports (interfaces), adapters (concrete providers),
repositories, and services. No framework code, no React, no Next.js — this
package is plain TypeScript so it can be unit-tested without a browser and
consumed by any app in the monorepo.

```
GPS fix
  ↓ ILocationProvider          (BrowserLocationProvider)
FunFinderService.search()
  ↓ IPlacesProvider            (GooglePlacesProvider | MockPlacesProvider)
  ↓ IRoutingProvider           (HaversineRoutingProvider)
  ↓ PlaceRepository            (cache/upsert)
  ↓ PreferenceRepository       (approved-memory weighting)
  ↓ RecommendationRepository   (record what was shown)
  ↓ AuditService                (record that a search ran)
RankedPlace[]
```

## Hexagonal boundaries

Every external capability is a port (`src/interfaces/*.ts`) with at least
one adapter (`src/providers/*.ts`):

| Port | MVP adapter | Real alternative |
|---|---|---|
| `ILocationProvider` | `BrowserLocationProvider` (browser Geolocation API) | Telematics hardware feed |
| `IPlacesProvider` | `GooglePlacesProvider` when `GOOGLE_MAPS_API_KEY` is set, else `MockPlacesProvider` | Any places/search API |
| `IRoutingProvider` | `HaversineRoutingProvider` (straight-line distance ÷ assumed speed) | Mapbox Directions / Google Routes / a commercial-vehicle routing API |
| `IMapProvider` | `OpenStreetMapProvider` (no API key) | Mapbox / Google Maps |

Nothing in `services/` imports a concrete provider — `FunFinderService` and
`MemoryService` only see the interfaces, injected by whoever composes them
(see `apps/truckeros-web/src/lib/composition.ts`).

## Data integrity rule

Truck attributes (`truck_accessible`, `large_vehicle_parking`,
`overnight_parking`, `showers`, `food`, `fuel`, `restrooms`, `24_hours`) are
stored in three separate buckets, not one flat object:

- `verified` — the places provider actually confirmed it (rare in practice).
- `userReported` — a driver told TruckerOS.
- `inferred` — a heuristic guess (address text, category keyword). Lowest trust.

`resolveTruckAttribute()` picks the highest-trust tier that has a value and
says which tier won. **`MockPlacesProvider` and `GooglePlacesProvider` never
write to `verified`** — only a places API that actually attests to the fact
would earn that. This is deliberate: it's the mechanism that stops a mock
fallback or a keyword guess from being presented to the driver as a
confirmed fact.

## Routing is honest about what it isn't

`HaversineRoutingProvider` computes straight-line distance and an ETA from
an assumed average speed. Every `RouteEstimate` it returns carries
`method: "haversine_estimate"` and `truckAwareRouting: false`. This package
does not implement bridge-height/weight-restriction/commercial-vehicle
routing, and does not pretend to — see the product spec's instruction not to
fake truck-specific routing. Navigation itself is a handoff:
`buildNavigationHandoffLinks()` (in `interfaces/routing.ts`) builds `geo:`,
Google Maps, and Apple Maps deep links so the driver's own navigation app
does the actual routing.

## Memory Core pipeline

`MemoryService` enforces:

```
Observation → MemoryCandidate (status: pending) → driver calls approve() → Memory + active Preference
```

`FunFinderService.search()` only ever reads from `PreferenceRepository`.
Nothing writes to it except `MemoryService.approve()`. A candidate that's
never approved can never influence a search — see
`FunFinderService.test.ts` ("lets an approved preference change ranking on
a later search") for the loop exercised end to end.

## Persistence

Every repository ships two implementations behind the same interface:

- `InMemory*Repository` — what `apps/truckeros-web` actually runs today.
  Data resets on process restart; that's an accepted MVP tradeoff, not a bug
  (see `storage/InMemoryStore.ts`).
- `Postgres*Repository` — real SQL against the schema in
  `sql/001_truckeros_core.sql`, injected via a `SqlClient` (`{ query(sql,
  params) }`) so this package never depends on `pg`/Supabase SDK specifics.
  Not wired into the web app by default — wire it up once a Postgres/Supabase
  instance and `DATABASE_URL` exist, without changing any service or route.

## Running checks

```bash
pnpm --filter @jhadina/truckeros-core type-check
pnpm --filter @jhadina/truckeros-core test
```

# TruckerOS (prototype) — GPS + FunFinder

A working engineering prototype, not a mockup. Proves one complete loop:

```
Real GPS location → FunFinder query → real nearby places → truck-aware
filtering → place details → native navigation handoff → save/feedback →
auditable memory
```

Domain logic (ports, adapters, services, repositories) lives in
[`@jhadina/truckeros-core`](../../packages/truckeros-core); this app is the
Next.js UI + API layer on top of it. See that package's README for the
architecture and the data-integrity/routing-honesty rules it enforces.

## Running it

```bash
pnpm install
cd apps/truckeros-web
cp .env.example .env.local   # optional — see below
pnpm dev
```

Open http://localhost:3000, grant location permission, and the loop is
live. Without `GOOGLE_MAPS_API_KEY` set, FunFinder runs on
`MockPlacesProvider` — every result is labeled `providerName:
"mock_offline"` (visible on the place detail screen) so it's never
confused with real data.

## Screens

| Route | Purpose |
|---|---|
| `/` | Driver Home — live GPS status, category quick filters, closest mixed recommendations |
| `/funfinder` | Map + filterable, truck-attribute-aware results list |
| `/place/[id]` | Place detail — Navigate / Save / Not interested / Add note |
| `/profile` | Driver baseline, saved places, committed memories |
| `/activity` | Pending memory candidates (approve/reject) + audit ledger |

## Architecture boundary

UI components never import a repository or service. Every screen calls an
`/api/*` route; every route is a thin wrapper (`src/app/api/**/route.ts`)
around a handler in `src/lib/routes/handlers.ts`; every handler calls into
`@jhadina/truckeros-core` services obtained from the composition root
(`src/lib/composition.ts`). See `packages/truckeros-core/README.md` for why
that composition root stashes its singleton on `globalThis` rather than a
plain module-scope variable — that's not stylistic, it's a fix for a real
bug (verified: separate API route files can end up with independent
`InMemoryStore` instances under Next's dev bundler otherwise).

## What's deliberately not built yet

Per the MVP scope: no fleet management, no autonomous recommendation
engine, no truck-specific turn-by-turn routing (routing is a straight-line
ETA estimate — see `HaversineRoutingProvider` — plus a handoff to the
driver's own navigation app), no telematics ingestion. These are listed as
explicit non-goals, not omissions.

## Verification

- `pnpm --filter @jhadina/truckeros-core test` — 17 unit tests covering the
  ranking formula, the truck-attribute trust hierarchy, and the full
  Memory Core state machine.
- `pnpm --filter @jhadina/truckeros-web test` — 8 tests, including one that
  drives the actual route handlers through the complete loop (search → save
  → candidate proposed → approve → committed memory → later search ranks
  differently because of it).
- `pnpm --filter @jhadina/truckeros-web build` — production build.
- See `ACCEPTANCE_TEST.md` for the manual/curl-driven end-to-end protocol
  and what was actually run to verify this MVP, with real output.

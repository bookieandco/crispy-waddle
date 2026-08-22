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

## AI Dispatcher (API only — no screen yet)

`POST /api/dispatcher` takes a natural-language driver message plus a
deterministic dispatcher context (candidate loads + the driver's own
minimum/target net-cents-per-mile) and returns ranked recommendations with
an explanation. The AI layer is strictly advisory: `DispatcherService`
(`@jhadina/truckeros-core`) computes every number and the accept/counter/
decline call deterministically; the reasoner only narrates the result it's
handed and cannot alter it or execute anything. See
`TRUCKEROS-02B_DISPATCHER_API.md` for the full contract, the safety-boundary
verification, and the live acceptance run.

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

- `pnpm --filter @jhadina/truckeros-core test` — 34 unit tests covering the
  FunFinder ranking formula, the truck-attribute trust hierarchy, the full
  Memory Core state machine, and the deterministic dispatcher
  economics/recommendation engine.
- `pnpm --filter @jhadina/truckeros-web test` — 17 tests, including one that
  drives the actual route handlers through the complete FunFinder loop
  (search → save → candidate proposed → approve → committed memory → later
  search ranks differently because of it), and a suite covering
  `/api/dispatcher`'s validation, ranking, and safety-boundary contract.
- `pnpm --filter @jhadina/truckeros-web lint` — 0 errors
  (`.eslintrc.json` extends `next/core-web-vitals`).
- `pnpm --filter @jhadina/truckeros-web build` — production build.
- See `ACCEPTANCE_TEST.md` for the FunFinder loop's manual/curl-driven
  protocol, `AUDIT.md` for the self-audit that followed it, and
  `TRUCKEROS-02B_DISPATCHER_API.md` for the dispatcher endpoint's.

# TruckerOS MVP — Acceptance Test

Per the verification discipline this MVP was built under: nothing here is
marked done from reading the code. Every step below was either run against
a live `next dev` server with real HTTP requests, or is called out
explicitly as needing a real device/browser and not yet run that way.

## The loop

1. Driver opens TruckerOS (`/`)
2. Browser geolocation permission requested and granted
3. Real GPS position renders on Driver Home
4. Driver taps FunFinder (or a quick-filter chip)
5. App calls `/api/funfinder/search` with the real coordinates
6. FunFinder returns real* nearby places sorted by distance
7. Driver applies a category filter / truck-parking toggle
8. Driver opens a place's detail page
9. Place detail shows truck attributes labeled by trust tier
10. Driver taps Navigate → native handoff link (`geo:`, Google Maps, Apple Maps)
11. Driver taps Save
12. Save shows up on `/profile`
13. The save produces a pending memory candidate on `/activity`
14. Driver approves the candidate
15. The approved preference visibly changes ranking on a later search

\* "real" here means real for whichever `IPlacesProvider` is configured.
Without `GOOGLE_MAPS_API_KEY`, results come from `MockPlacesProvider` and
are labeled `providerName: "mock_offline"` end to end — see
`packages/truckeros-core/README.md`.

## What has been run, and what it proved

### Steps 4–15: run against a live server, full loop, real output

Verified 2026-08-09 by starting `pnpm dev` and driving the actual API
routes with `curl` (not a mock, not a code read):

```
POST /api/location   {latitude: 32.7767, longitude: -96.797, ...}
  -> driver.currentLocation updated

GET /api/funfinder/search?lat=32.7767&lng=-96.797&category=bbq
  -> 3 results, sorted, e.g.
     "Smokehouse Pullout BBQ" distanceMeters=2505.5 etaMinutes=2 rankScore=36.1
     rankReasons: ["+26.9 proximity (1.6 mi)", "+9.2 rating (4.6)"]

GET /api/places/place_1
  -> full place record, truck attributes bucketed (verified/userReported/inferred)

POST /api/interactions {placeId: place_1, eventType: "viewed"}
  -> interaction_1 recorded, no memory candidate (viewing isn't a positive signal)

POST /api/interactions {placeId: place_1, eventType: "saved"}
  -> interaction_2 recorded AND memoryCandidate cand_1 proposed:
     "Driver saved a bbq place with truck parking: \"Smokehouse Pullout BBQ\"."
     proposedPreference: {key: "preferred_category_with_parking", value: "bbq", weight: 5}

GET /api/saved-places
  -> saved_1, joined with the place record

GET /api/memory/candidates
  -> cand_1, status: "pending"

POST /api/memory/candidates/cand_1/approve
  -> mem_1 created, compiledPreferenceRule matches the candidate's proposal

GET /api/memory
  -> mem_1 visible, appliedAt stamped

GET /api/funfinder/search?lat=32.7767&lng=-96.797&category=bbq   (re-run)
  -> "Smokehouse Pullout BBQ" rankReasons now includes:
     "+35 approved preference match with confirmed truck parking (inferred)"
  -> "Downtown Slow Smoked" (no truck parking data) — no such reason, unchanged

GET /api/audit?limit=20
  -> 7 events in order: location.updated, funfinder.search_executed,
     interaction.recorded (viewed), interaction.recorded (saved),
     memory.candidate_proposed, memory.approved, funfinder.search_executed
  -> every entry carries triggeredBy and driverApproved (null except the
     approval itself, which is true)
```

All 5 screens (`/`, `/funfinder`, `/profile`, `/activity`, `/place/[id]`)
were requested from the running server and returned 200 with no server
errors in the dev log.

This is the same loop exercised automatically in
`apps/truckeros-web/src/lib/routes/handlers.test.ts` ("runs the full loop:
search -> save -> memory candidate -> approve -> influences a later
search"), which passes in CI-style `vitest run` without a browser.

### A real bug this process caught and fixed

The first version of `handleFunFinderSearch` validated coordinates with
`Number.isFinite(Number(searchParams.get("lat")))`. `Number(null)` is `0`,
not `NaN` — so a request with no `lat` at all silently proceeded with
`(0, 0)` instead of being rejected. The `handlers.test.ts` case "rejects
missing coordinates" failed against the real handler and caught this before
it shipped; the fix checks for the raw query param's presence first.

A related bug surfaced only by hitting a live server, not by the test
suite: the composition root's singleton (`getTruckerOS()`) used a plain
module-scope `let context`, which is **not** reliably shared across
different Next.js API route files under the dev bundler — verified by
watching `/api/places/[id]` fail to find a place that `/api/funfinder/search`
had just created in what should have been the same in-memory store. Fixed
by stashing the singleton on `globalThis` (see `composition.ts`), then
re-ran the entire curl sequence above end to end to confirm it actually
fixed the issue, not just plausibly addressed it.

### Steps 1–3, 10: require a real device/browser, not yet run that way

- Actual browser geolocation permission prompt and a real device's GPS fix
  — `BrowserLocationProvider` was verified by type-check and by manual
  reasoning about the Geolocation API contract, but this MVP has not yet
  been opened in an actual browser with location services on. That is the
  next verification step before calling GPS "done."
- Native navigation handoff — `buildNavigationHandoffLinks()` produces
  correct `geo:`/Google Maps/Apple Maps URLs (asserted in
  `FunFinderService` usage and visible in the rendered `<a href>` on the
  place card), but whether tapping them actually opens Google Maps/Waze/
  Apple Maps on a real phone has not been observed.

Both are marked here explicitly rather than assumed, per the instruction
not to mark anything complete from static inspection.

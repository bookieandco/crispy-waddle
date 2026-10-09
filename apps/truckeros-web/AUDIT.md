# TruckerOS MVP — Audit (2026-08-09)

A self-audit of the initial implementation, done by re-reading the code
adversarially and re-running verification rather than trusting the original
pass. Four real issues were found; three were fixed and verified, one is
disclosed as a known limitation rather than silently left.

## Fixed

### 1. Duplicate places in the `category=all` mix (real bug, Google-provider-only)
`FunFinderService.search()` runs the "all" mix as four parallel category
queries and flattened the results with no dedup. `MockPlacesProvider`
never surfaces this because its ids are namespaced per category
(`mock_bbq_0`, `mock_food_0`, ...), but a real provider like Google Places
returns the same place's real id for every query it matches — a diner that
reads as both "food" and "attractions" would come back twice, under two
different category labels, and the Driver Home mixed list would show it
twice.
**Fix:** dedupe on `providerName:providerId` before ranking.
**Verified:** new test `FunFinderService.test.ts` — "dedupes a place
returned by more than one category query in the 'all' mix" — using a fake
provider built specifically to reproduce the overlap Mock can't.

### 2. `MockPlacesProvider` silently ignored `radiusMeters`
Offsets were fixed constants (`0.015`/`0.02` degrees) regardless of the
requested search radius. A driver requesting a 1-mile radius would get mock
results ~3+ miles out; a 25-mile radius would get results bunched
unrealistically close. This wasn't caught by the original acceptance run
because that run only ever exercised the default ~10mi radius.
**Fix:** offsets are now derived from `radiusMeters` (spread across
~20–80% of it, at alternating bearings), converted through the same
meters-per-degree approximation `geo.ts`'s `boundingBox()` already uses.
**Verified:** new `MockPlacesProvider.test.ts` — asserts every generated
result's real haversine distance from the origin is within the requested
radius, at both a 1mi and a 25mi radius, and that the two produce visibly
different spreads. Also spot-checked live against a running server (1mi
request: results at 563m/804m/1045m; 25mi request: 14063m/20102m/26111m).

### 3. Disabled button nested in a `Link` still navigated
On Driver Home, the "Find Something Fun" button and quick-filter chips were
`<button disabled={!coords}>` nested inside `<Link href={coords ? ... :
"#"}>`. `disabled` only affects the button element — a click still reaches
the wrapping `<a>`, so tapping the greyed-out button before GPS resolved
navigated to `#` instead of doing nothing. Not harmful (no crash, no bad
state), but real and sloppy.
**Fix:** don't render the `Link` at all while `coords` is null; render a
plain disabled `<button>` instead.
**Verified:** type-check, build, and a live `GET /` all still pass; the
conditional was exercised by hand-reading the render branches (no
automated UI test covers click behavior yet — see "Not yet verified"
below).

### 4. Redundant double GPS request in `useDriverLocation`
The hook called both `provider.getCurrentLocation()` and
`provider.watchLocation()` on mount. Per the Geolocation API spec,
`watchPosition`'s first callback already delivers an initial fix, so this
issued two concurrent location requests for the same first fix — on some
browsers, potentially two permission-adjacent prompts, and needless GPS
radio use.
**Fix:** dropped the separate `getCurrentLocation()` call; `watchLocation`
alone now supplies both the initial fix and subsequent updates.
**Verified:** type-check, build, and the full live curl loop still pass
(GPS mocking isn't available in this environment's test runner, so this is
verified by reading the Geolocation API contract, not by observing an
actual browser make one request instead of two — see below).

## Known limitation, disclosed rather than fixed

### Postgres repositories and `GooglePlacesProvider` are unverified by execution
Every `Postgres*Repository` (real SQL, hand-checked column-by-column
against `sql/001_truckeros_core.sql`) and `GooglePlacesProvider` (Google
Places (New) Text Search request shape, checked against the documented API
contract) have never actually run against a live database or a real Google
API key — there isn't one in this environment. They're consistent by
inspection, not proven by execution. Anyone wiring either of these up
should treat first use as the actual test, not this audit.

## Not yet verified (unchanged from `ACCEPTANCE_TEST.md`)

Real device/browser GPS permission grant, and tapping Navigate to confirm
a native maps app actually opens — both still require a real device, which
this environment doesn't have.

## What this audit did *not* find a problem with

Re-checked and confirmed correct: the `preferred_category` vs
`preferred_category_with_parking` ranking split (a parking-gated
preference only pays out when the place actually has parking data, not on
category match alone — this was itself a bug caught and fixed during the
original build, re-verified here); the `globalThis` composition-root
singleton fix (re-ran the full curl loop fresh, still holds); every
Postgres repository's SQL columns against the schema, one by one; no
`dangerouslySetInnerHTML` or other unescaped-render risk anywhere in the
UI; no route lacks its documented input validation.

`liked`/`disliked` interaction types exist in the type system, the SQL
check constraint, and `MemoryService` (treated as a positive signal
alongside `saved`) because the product spec's own database blueprint
includes them, but no screen has a button that sends either — the spec's
result-card button list (Navigate / Save / Not interested / Add note) does
not call for one. Noted here as a completeness gap, not a bug.

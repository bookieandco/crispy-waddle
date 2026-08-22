# TRUCKEROS-02B — Dispatcher API

Built on PR #86 (`feat(truckeros): add AI dispatcher foundation`), which
shipped the deterministic `DispatcherService` and the `IDispatcherReasoner`
port but no HTTP endpoint and no concrete reasoner. This milestone adds
both, as an isolated addition — no existing route, screen, or service was
changed to make this work.

## What shipped

- `packages/truckeros-core/src/providers/TemplateDispatcherReasoner.ts` —
  the first concrete `IDispatcherReasoner`. Deterministic and
  template-based, not a live LLM call (no API key is configured in this
  environment) — same honesty pattern as `MockPlacesProvider`: it never
  hides what it is, and it never states a dollar figure that isn't already
  present in the `DispatcherBrief` it was handed.
- `POST /api/dispatcher` (`apps/truckeros-web/src/app/api/dispatcher/route.ts`
  → `handlePostDispatcher` in `src/lib/routes/handlers.ts`).
- Composition root wiring (`dispatcherService`, `dispatcherReasoner` added
  to `TruckerOSContext`).

## Request/response contract

```
POST /api/dispatcher
Content-Type: application/json

{
  "message": string,              // 1–2000 chars, the driver's natural-language question
  "context": {
    "loads": LoadOffer[],         // 1–25 items, all fields required except pickupAt/deliveryAt/brokerName
    "minimumNetCentsPerMile": number,
    "targetNetCentsPerMile": number   // must be >= minimumNetCentsPerMile
  }
}
```

`driver` and `currentLocation` are never accepted from the client — like
every other route in this app, they're resolved server-side from the
seeded demo driver, so the caller can't spoof who the recommendation is
for.

```
200 OK
{
  "success": true,
  "data": {
    "brief": DispatcherBrief,      // recommendation, headline, ranked candidates, warnings — all deterministic
    "explanation": string,          // advisory narrative, grounded in `brief`
    "safety": {
      "aiRole": "advisory",
      "economicsSource": "deterministic",
      "executionAllowed": false,
      "requiresDriverApproval": true
    }
  }
}
```

`400` for any validation failure, naming the exact field (e.g.
`"context.loads[0].revenueCents is required and must be a finite number"`).
Malformed JSON is also a `400`, not a `500`.

## Safety boundary — verified, not just stated

The task requirement was: *AI is advisory; economics remain deterministic;
no external commitment can execute without driver approval.* This is
enforced at three points, each with a test:

1. **The reasoner cannot touch the numbers.** `IDispatcherReasoner.explain(brief, question?)`
   takes `brief` by value and returns a `string`. There is no method on the
   interface that lets it write back to `brief`, and `handlePostDispatcher`
   computes `brief` before calling the reasoner and never re-reads anything
   from the reasoner except the explanation string.
   Verified: `TemplateDispatcherReasoner.test.ts` — "never fabricates a
   dollar figure that isn't already in the brief" (regex-extracts every
   `$` amount from the explanation and asserts each one appears verbatim in
   `brief.headline` or a candidate's `reasons`) — and the same check again
   at the HTTP layer in `handlers.test.ts`, in case JSON round-tripping
   ever introduced a discrepancy the unit test wouldn't catch.
2. **The response has no execution path.** No field named `execute`,
   `book`, `commit`, or `confirmBooking` (or any casing thereof) appears
   anywhere in the response payload — checked directly, not just by
   omission from the code I wrote.
   Verified: `handlers.test.ts` — "returns a ranked brief, an explanation,
   and an explicit safety block with no execution capability" serializes
   the full response and asserts none of those strings appear.
3. **Every query is on the record.** Each call writes an
   `audit_events`-style entry (`dispatcher.brief_requested`,
   `triggeredBy: "driver_action:dispatcher_query"`, `driverApproved: null`
   — null because a query isn't itself an approval, and nothing here
   should ever record `true` since nothing here can be approved into
   execution).
   Verified: `handlers.test.ts` — "records an audit event for every
   dispatcher query, advisory (driverApproved: null)".

The `safety` block in the response is deliberate: it makes the boundary
part of the checkable API contract, not just something asserted in this
document.

## A defect this validated the API against catching

`DispatcherService.evaluateLoad` checks `netPerMile >= target` before
`netPerMile >= minimum`. If a caller supplied `targetNetCentsPerMile <
minimumNetCentsPerMile`, a load between the two would hit the target check
first and come back `"accept"` despite not clearing the driver's own
floor. Rather than let the deterministic layer produce that inversion,
`handlePostDispatcher` rejects the request outright when target < minimum.
This is an API-boundary guard, not a fix to `DispatcherService` itself —
the service's internal ordering still isn't defended against an inverted
pair if some other caller constructs a `DispatcherContext` directly without
going through this endpoint. Flagged here rather than silently patched
into someone else's PR beyond what was needed to validate it.

## Test coverage added

- `packages/truckeros-core/src/providers/TemplateDispatcherReasoner.test.ts`
  — 5 tests (no-fabrication check, question echoing, the "nothing is
  committed" line, runner-up mention, empty-brief handling).
- `apps/truckeros-web/src/lib/routes/handlers.test.ts` — 9 new tests under
  "route handlers — POST /api/dispatcher": missing message, empty loads,
  a load missing a required field (asserts the exact error string), an
  inverted threshold pair, malformed JSON, the full happy-path contract
  (including the `safety` block and the no-execution-field check), the
  no-fabricated-dollar-figure check at the HTTP layer, the audit-trail
  check, and multi-load ranking (stronger load first, weak one declined).

Totals: 34 core tests — 26 once PR #86's own fixture bug was fixed, +3
`DispatcherService` boundary-coverage tests added during that same
validation pass (29), +5 `TemplateDispatcherReasoner` tests from this
milestone (34). Web: 8 tests before this milestone, +9 from
`/api/dispatcher`'s test suite (17).

## Live acceptance run (2026-08-18)

Run against `pnpm dev` with real HTTP requests, not read from the code:

```
POST /api/dispatcher {message: "Should I take the Houston to Dallas load?", ...}
  -> 200, recommendation: "accept", headline: "ACCEPT: Houston, TX → Dallas, TX.
     Estimated net $1667.00 ($5.95/mile).", safety.executionAllowed: false

POST /api/dispatcher {context: {loads: [], ...}}                    -> 400 (empty loads)
POST /api/dispatcher {context: {..., minimum: 500, target: 400}}    -> 400 (inverted thresholds)
POST /api/dispatcher {body: "{not json"}                            -> 400 (not 500)
POST /api/dispatcher {load missing revenueCents}
  -> 400 "context.loads[0].revenueCents is required and must be a finite number"
POST /api/dispatcher {26 loads}                                     -> 400 "must contain 25 or fewer"

POST /api/dispatcher {two loads: weak (revenue 80_000) vs strong (revenue 220_000)}
  -> strong: accept, 631.1 cents/mile; weak: decline, 131.1 cents/mile
  -> overall recommendation: accept
  -> explanation: `...1 other load was also evaluated; the next best is A → B
     at $1.31/mile. This is a recommendation, not a booking — nothing is
     committed until you approve it.`

GET /api/audit?limit=5
  -> dispatcher.brief_requested | triggeredBy=driver_action:dispatcher_query
     | driverApproved=None   (x2, one per query above)
```

`type-check`, `lint` (0 errors), `test` (both packages), and `next build`
all pass on this branch as of this milestone.

## Known limitations (disclosed, not fixed here)

- `TemplateDispatcherReasoner` is not a real language model. It's honest
  about that (see the class doc comment) but it means the "explanation"
  quality is mechanical, not conversational — swapping in a real
  LLM-backed `IDispatcherReasoner` is future work, and per the safety
  boundary above, that adapter should still only be handed `brief` to
  narrate, never the raw loads to re-derive numbers from.
- There's no persistence for dispatcher context. The caller supplies the
  full candidate-load list on every request; there's no "load board"
  repository yet. This mirrors PR #86's own scope (it shipped no
  repository either) and is left as-is rather than expanded beyond this
  milestone.
- No UI screen calls this endpoint yet — it's API-only, as the milestone
  asked for.
- Single demo driver, no auth — consistent with every other endpoint in
  this app.

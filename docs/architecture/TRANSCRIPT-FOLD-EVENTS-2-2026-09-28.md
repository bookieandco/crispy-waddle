# TRANSCRIPT-FOLD.EVENTS.2 — shared learning event fabric

Date: 2026-09-28  
Repository: `bookieandco/crispy-waddle`  
Live Supabase: SWLC / `kqbkaozfjubkjevdfvic`

## Objective

Connect the durable commercial-learning, prospect-intelligence, and Social canary records from RUNTIME.1 to Jhadina's existing ONE-RUNTIME event journal.

The event fabric is coordination and evidence only. Event health, receipt state, replay state, and derived proposals never grant external-action authority.

## Canonical source events

The shared event contract now includes:

- `commercial.offer_canvas.persisted`
- `commercial.validation_test.persisted`
- `commercial.market_learning.observed`
- `commercial.proof_sprint.persisted`
- `commercial.recurring_offer.assessed`
- `prospect.icp.persisted`
- `prospect.record.persisted`
- `social.publish_canary.created`
- `social.publish_canary.receipt_captured`

All producer events require:

- an owned open WorkSession;
- WorkSession/correlation lineage;
- owned task lineage when a task ID is supplied;
- deterministic WorkSession-scoped idempotency;
- server-bound actor identity;
- no `authorityRef`.

Prospect event payloads intentionally exclude names, email addresses, phone numbers, and other contact details. They carry stable IDs, fit/contact-quality/suppression state, and evidence references.

## Runtime producers

RUNTIME.1 write APIs now emit the canonical source event after successful persistence:

- `POST /api/opportunities/[id]/commercial`
- `POST /api/opportunities/prospects`
- `POST /api/social/canaries`
- `POST /api/social/canaries/[id]/receipt`

The caller supplies only a trace context:

```json
{
  "runtime": {
    "workSessionId": "ws:...",
    "taskId": "optional-task-id",
    "correlationId": "corr:...",
    "causationId": "optional-prior-event-id"
  }
}
```

Domain, capability, actor, event ID, idempotency key, and lack of authority are determined server-side.

## Replay / learning consumer

A checkpointed replay consumer is available through:

`POST /api/jhadina/runtime/transcript-fold/replay`

Consumer ID:

`transcript-fold-learning-v1`

It uses the existing `consumeReplayBatch` at-least-once contract and the durable per-WorkSession checkpoint store.

Current derived behavior is intentionally narrow:

### Market learning

Every `commercial.market_learning.observed` event may create:

- `focus.reassessment.requested`

Only `paid` or `repeat` commitment evidence may additionally create:

- `growth.content_candidate.proposed`

The Growth candidate is produced through the existing `buildWorkToContentCandidate` contract and remains `CONTENT_CANDIDATE_ONLY`. It does not draft or publish anything.

### Recurring-offer assessment

`commercial.recurring_offer.assessed`

may create:

- `focus.reassessment.requested`

### Social canary receipt

`social.publish_canary.receipt_captured`

may create:

- `focus.reassessment.requested`

It does not grant expansion or publication authority. Social's existing canary assessment and canonical publication approval/outbox remain authoritative.

## Replay safety

Derived event IDs are deterministic from source lineage. If a consumer crashes after creating a derived event but before advancing the replay checkpoint, replay sees the source again but the durable event journal suppresses the duplicate derived event.

Checkpoints advance only after the handler completes.

## Live infrastructure reconciliation

The source repository already contained:

`supabase/migrations/20260927023500_one_runtime_task_event_persistence.sql`

but SWLC had not actually applied it.

EVENTS.2 applied that existing canonical migration live instead of inventing a parallel event store.

Live tables now present:

- `jhadina_work_session_tasks`
- `jhadina_runtime_events`
- `jhadina_runtime_event_checkpoints`

Verified privilege boundary:

- RLS enabled on all three;
- anon/authenticated cannot directly read the event/task/checkpoint tables;
- `jhadina_runtime_events` is append-only for service role;
- checkpoints are service-role readable/writable but not deletable;
- event replay/checkpoint RPCs remain service-role-only.

## Live smoke

A transaction created a temporary owned WorkSession and source market-learning event, then verified:

1. initial consumer checkpoint = 0;
2. replay RPC returned exactly the source event;
3. checkpoint CAS advanced to the source sequence;
4. final checkpoint was nonzero.

The transaction was rolled back. Zero smoke WorkSessions, events, or checkpoints remained.

## Next boundary

`TRANSCRIPT-FOLD.FOCUS-LIVE.3`

Consume `focus.reassessment.requested` into the real WorkSession/Focus projection and surface:

- owner attention item;
- system bottleneck;
- parallel Jhadina work;
- maintenance share;
- deferred exploration.

The Focus consumer may reprioritize coordination state, but still cannot grant subsystem execution authority.

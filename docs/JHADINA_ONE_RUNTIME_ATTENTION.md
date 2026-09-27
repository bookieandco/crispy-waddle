# JHADINA-ONE-RUNTIME.3 — human-attention projection

## Goal

Give Ask Jhadina and the future Command Center one subsystem-neutral answer to:

> What actually needs me?

Background work that can continue automatically should stay out of the user's way.

## Human-attention states

The projection surfaces only:

- `waiting-approval` — approve or reject;
- `blocked` — resolve the blocker;
- `failed` — review the failure;
- `paused` — resume or cancel.

Queued, dependency-waiting, ready, running, retrying, completed and cancelled tasks do not become human-attention items by default.

An exhausted failure is critical. Other failures/blockers/approvals are high priority. Paused work is medium priority.

## Non-authority rule

The projection is read-only presentation.

It cannot:

- approve;
- resume;
- cancel;
- retry;
- execute;
- spend;
- publish;
- trade;
- bet;
- order;
- submit.

Any resulting user action must still route through the canonical task/action/governance path.

## Intended UI

This becomes the source for experiences like:

```text
Jhadina, what needs me?

3 things:
1. Approve Director final cut.
2. Pupson sample mapping is blocked on a provider credential.
3. SAM proposal generation exhausted its retry budget.
```

Everything else continues without being surfaced as noise.

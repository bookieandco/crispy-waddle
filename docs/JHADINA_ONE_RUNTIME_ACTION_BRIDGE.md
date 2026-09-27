# JHADINA-ONE-RUNTIME.8 — WorkSession to Action Core bridge

## Purpose

Every consequential subsystem action should enter the existing Action Core with identical runtime lineage.

Without a shared bridge, Director, Social, Growth, Money, Commerce, SAM and future subsystems could each hand-build slightly different WorkSession metadata.

## Binding

For a running or approval-waiting WorkSession task, the bridge binds:

- WorkSession ID;
- task ID;
- correlation ID;
- causation ID when present;
- domain;
- capability;
- idempotency key.

The Action Core request's user must match the task owner.

If a request already contains runtime context, every lineage field must match the task exactly or the bridge fails closed.

## Allowed task states

Only:

- `running`;
- `waiting-approval`

may be bound to an Action Core request.

A queued/ready/dependency-waiting/blocked/paused/terminal task must first move through the canonical scheduler/task lifecycle.

## Authority

This bridge does not:

- make the task executable;
- issue an approval receipt;
- approve an action;
- change Security Core policy;
- choose an Action Core handler;
- execute a side effect.

It only ensures that when Action Core evaluates and audits a request, the action can be traced back to the exact WorkSession task that produced it.

## Result

Future operations such as:

- social publication;
- ad spend;
- Printify fulfillment;
- wallet/trade execution;
- sportsbook/prediction-market execution where legally/provider-supported;
- SAM outreach/submission;
- external messages;

can all use one lineage contract while preserving their existing domain-specific policy and execution authorities.

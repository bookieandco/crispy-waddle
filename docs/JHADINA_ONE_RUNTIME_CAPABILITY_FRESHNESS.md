# JHADINA-ONE-RUNTIME.7 — capability freshness

## Problem

Source code, green CI, a configured provider, and a runtime that worked earlier are not the same thing as a capability that is usable now.

ONE-RUNTIME therefore separates configured runtime state from effective runtime state.

## READY admission

A capability may be recorded as `ready` only when it carries live-runtime evidence that:

- identifies its source;
- has a valid observation timestamp;
- has an explicit expiry;
- is still unexpired when READY is recorded.

CI/source evidence alone cannot produce READY.

## Effective state

At read time Jhadina evaluates evidence freshness.

### READY

If fresh live-runtime evidence still exists:

`READY -> READY`

If all live-runtime evidence has expired:

`READY -> DEGRADED`

with reason:

`LIVE_RUNTIME_EVIDENCE_EXPIRED`

### DEGRADED / PAPER_ONLY / SIMULATION_ONLY

When all recorded expiring evidence becomes stale, the effective state becomes:

`UNKNOWN`

rather than silently claiming the old limited runtime still exists.

### BLOCKED / DISABLED

These remain fail-closed until explicitly changed.

An expired blocker does not automatically make a capability available.

## Why

This prevents experiences such as:

- a TV player claiming READY because playback worked yesterday;
- SHARK claiming live execution because a provider worked before credentials expired;
- a Director worker claiming READY after the GPU service disappeared;
- SAM claiming an active submission adapter based only on source/configuration.

Ask Jhadina and the future System Status surface should consume **effective** state for current capability questions.

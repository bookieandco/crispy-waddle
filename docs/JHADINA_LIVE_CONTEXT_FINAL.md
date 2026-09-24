# JHADINA-LIVE-CONTEXT.FINAL

Certification date: 2026-09-23 (America/Los_Angeles)

Status: **PASS / CLOSED**

## Goal

Make screen, admitted files, recent conversation, and active WorkSession behave as
one bounded continuity layer so the user can naturally say things like:

- "look at that";
- "the thing on the left";
- "compare this to the earlier one";
- "use that file again";
- "keep working on what we were doing";

without Jhadina inventing a referent or promoting ephemeral context into Memory.

## Canonical live-context contract

`JHADINA-LIVE-CONTEXT.FINAL` defines:

- recent conversation turns: max 8;
- admitted WorkSession artifact IDs: max 8;
- active subsystem labels: max 16;
- retained distinct screen frames: 2;
- screen-change mean-absolute threshold: 7.

Recent turns and WorkSession metadata are continuity context only. They are not
independent evidence, durable Memory, authorization, or action approval.

## Screen continuity

While screen sharing is active:

1. the browser samples a 16x9 grayscale representation of the shared screen;
2. near-identical captures are suppressed;
3. a meaningful change promotes the old current frame to
   `screen:previous`;
4. the new frame becomes `screen:current`;
5. both carry their original observed timestamps and are sent as ephemeral image
   evidence;
6. stopping screen share clears both frames.

This means "compare this to earlier" can be grounded in two actual distinct frames,
not a fabricated recollection.

## Conversation continuity

Ask Jhadina sends the previous eight bounded user/Jhadina turns in `liveContext`.
The active user command remains `activeTask`; it is not duplicated into the history.

The server:

- validates the source;
- bounds turn count and text length;
- strips malformed turns;
- redacts secret-like text before model admission;
- provides explicit limitations that the context is non-authoritative.

The model is instructed to resolve pronouns only when the supplied screen/file
artifacts, recent turns, and active WorkSession make the referent unambiguous.
Otherwise it must ask a focused clarification.

## WorkSession continuity

On reload or session resume, Ask Jhadina now restores:

- current goal;
- active subsystem labels;
- admitted artifact IDs.

Restored artifact IDs are merged rather than overwritten by the child input's empty
initial file list. Each later command re-resolves those IDs through the existing
clean-artifact resolver, so a stored ID is not automatically trusted merely because
it appeared in a WorkSession.

New subsystem activity is unioned with the resumed session instead of erasing the
previous thread.

## Evidence and privacy boundaries

Live continuity:

- cannot populate durable Memory by itself;
- cannot populate Knowledge by itself;
- cannot grant capability or approval;
- cannot bypass clean-artifact admission;
- is secret-redacted before model context;
- remains bounded;
- is discarded when screen sharing stops or the browser session ends, except for
  the existing WorkSession metadata that was already durably admitted.

## Production health

Public read-only health endpoint:

`GET /api/jhadina/live-context/health`

READY requires the canonical bounded-continuity contract to report READY and exposes
the production commit/environment for exact-lineage verification.

## FINAL admission

`JHADINA-LIVE-CONTEXT.FINAL` requires:

1. dedicated exact-head workflow PASS;
2. live-context helper/core/context/model tests PASS;
3. Core Spine, Intelligence Core, and Web type-checks PASS;
4. production build PASS;
5. merge to current `main`;
6. Vercel READY on that exact main SHA;
7. `GET /api/health` reports the exact SHA;
8. `GET /api/jhadina/live-context/health` = READY;
9. `GET /ask-jhadina` = 200;
10. no Ask/live-context runtime error cluster on the exact production deployment.

A real physical screen-share drill can strengthen the receipt but is not fabricated
if browser automation cannot supply OS-level screen-sharing permission.


## Production closure receipt

Source implementation PR: **#680**  
Merged production lineage: `92bd7433971baf346ac1ba23d867d6633aec521d`  
Production deployment: `dpl_3yFvsFzvqWLCoBiAvbd71jenzAcL`

The merged commit is identical to current `main` and the Vercel deployment for
that exact SHA reached `READY` with the canonical production alias attached and
no alias error.

Live verification on the exact merged deployment:

- `GET /api/health` = HTTP 200;
- `/api/health` reports `environment=production`;
- `/api/health` reports exact commit
  `92bd7433971baf346ac1ba23d867d6633aec521d`;
- durable Memory health = `ready`;
- `GET /api/jhadina/live-context/health` = HTTP 200 / `READY`;
- live-context contract version = `JHADINA-LIVE-CONTEXT.FINAL`;
- all six live-context health checks = true:
  - bounded recent turns;
  - bounded admitted artifacts;
  - bounded active subsystems;
  - two-frame distinct-screen history;
  - ambiguity requires clarification;
  - continuity remains non-authoritative;
- production limits report 8 recent turns, 8 admitted artifact IDs,
  16 active subsystems, 2 retained distinct screen frames, and screen-change
  threshold 7;
- `GET /ask-jhadina` = HTTP 200;
- no runtime error clusters were observed for
  `/ask-jhadina`, `/api/jhadina/live-context/health`,
  `/api/jhadina/command`, or `/api/health`;
- no error/fatal runtime logs were observed on the exact production deployment.

The source-certification head also passed the dedicated
`Jhadina Live Context Final Certification` workflow plus the broader Launch,
JLLM, Interactive, Interaction Quality, Personality, Evolution, UX, Social,
Growth, Media, Spatial, Safety, INTCOM, Staffing, and Web Deploy Conformance
gates before merge.

No claim is made that an automated browser completed a real OS-level
screen-share permission drill. The production certification covers the deployed
contract, source tests, build/type gates, exact deployment lineage, health
endpoint, Ask availability, and runtime-error sweep.

Canonical result:

**`JHADINA-LIVE-CONTEXT.FINAL = PASS / CLOSED`**

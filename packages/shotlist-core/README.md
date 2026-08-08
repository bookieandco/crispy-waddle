# @jhadina/shotlist-core

Director Control Extension: cinematic-intent fields on a shot, threaded
through to prompt emission alongside locked entity traits and reference
assets.

## Scope

- `DirectorControls` — `lens`, `cameraMovement`, `framing`, `lightingMood`,
  `performanceIntensity`, `durationSeconds`. Optional and additive on
  `Shot`; every shot built without knowing about it keeps compiling and
  behaving exactly as before.
- `emitPrompts` / `PromptTarget` — `seedanceTarget` and `higgsfieldTarget`
  each include a `Director: ...` instruction line when `shot.director` is
  present, and omit it entirely when absent. Locked traits
  (`Entity.lockedTraits`) and reference assets (`ReferenceAsset`) render
  exactly as they did before this extension; director controls add an
  instruction line, they don't add a second traits/assets lookup.
- `isApproved(shot)` — the existing status-based approval gate, unaware of
  `director` by design.

## Design note: one `Shot` type, not two

This package does not split `Shot` into an emitter-local type and a
DB-backed type. This codebase has no shot persistence layer yet, so
modeling that split now would describe a database that doesn't exist.
`director` lives on the single canonical `Shot`; if/when persistence is
added, it persists like any other optional field, no migration of this
package required.

## Non-goals

No new memory or asset pathway. No new database. No ComfyUI / image or
video generation — that needs infrastructure (GPU-backed model serving)
this package deliberately does not take a position on.

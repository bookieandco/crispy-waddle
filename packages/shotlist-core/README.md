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

## Polish pass (post-processing)

`src/polish.ts` adds a prompt-level "de-slop" post-processing step. This
package has no pixel pipeline, so post-processing here means appending a
structured photographic-treatment block — film stock, lens notes,
lighting setup, composition rule, grain, plus a fixed set of "avoid"
directives (airbrushed skin, oversaturated glow, symmetrical AI features,
watermark artifacts) — to the rendered prompt when a shot's
`director.lookPreset` names a catalog entry. Unset or unrecognized preset
ids are a no-op, same discipline as `DirectorControls` itself.

`emitPrompts` applies the polish pass automatically; calling a
`PromptTarget.render()` directly does not, by design (it stays a pure
render of the base prompt).

The structured field set (camera/lens, film stock, lighting, composition
rule) is modeled on
[ComfyAssets/kiko-flux2-prompt-builder](https://github.com/ComfyAssets/kiko-flux2-prompt-builder)'s
photography-prompt schema. The named presets (Classic Chrome, Provia) are
modeled on real Fujifilm film simulations from
[fredrikaverpil/photography](https://github.com/fredrikaverpil/photography),
plus two classic still-photography stocks (Kodak Portra, Tri-X push-process)
for range.

Three other reference repos were reviewed and are **not** reflected in
code here, for concrete reasons: `ByteDance-Seed/VeOmni` is distributed
*training* infrastructure, unrelated to prompt post-processing;
`jianghd1996/Camera-control` is academic camera-path ML research with no
documented parameter schema to port; `inanevin/Cine-AI` is a Unity C#
director-style cutscene toolset — its "named director style" idea is
conceptually consistent with `DirectorControls` but there's no TypeScript
to reuse.

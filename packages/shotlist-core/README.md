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

## Reference material syntax fix (Seedance 2.0 / Higgsfield fidelity)

`beshuaxian/higgsfield-seedance2-jineng` is a set of Claude skills written
specifically for prompting Seedance 2.0 on Higgsfield — the exact two
targets this package already exports as `seedanceTarget` /
`higgsfieldTarget`. Its `01-cinematic/SKILL.md` documents the real
material-reference syntax those prompts expect: `@material[name]:
description`, not a generic list of URIs. `materialReferencesFor()` in
`emit.ts` now emits that syntax on both targets — a platform-fidelity
fix, not a new asset pathway: same `ReferenceAsset[]` input, only the
output string format changed.

That skill repo also documents measurable camera-move phrasing (e.g.
"dolly forward at constant 2 feet/second"), a 10-second hook/establish/
escalate/climax timeline model, and three-point lighting with Kelvin +
intensity-ratio specs. None of that is wired into code yet —
`DirectorControls.cameraMovement` / `lightingMood` stay free-text fields,
so this doesn't force a schema change nobody asked for — but it's a real
option for a future pass if generated prompts need to get more specific.

Two further repos from the same round were reviewed and intentionally
left out: `blender/blender` is GPL-3.0 3D-suite source, not something to
vendor into this package, and its docs didn't surface a portable
camera-metadata schema either; `devanshutak25/3d-resources` is a curated
link index (3,400+ external tools/tutorials), not a code source — useful
for browsing, nothing to integrate.

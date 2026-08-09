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

## Assembly layer: how "longer" actually happens (`src/assembly.ts`)

Ten more repos were reviewed as pieces of an "all-in-one AI cartoon and
film pipeline." The load-bearing fact across them: every generation model
in this space caps out short — `Wan-Video/Wan2.2` confirmed ~5s @ 720p,
GPU-only, no API. There is no model to reach for that just makes one long
video. Longer-form output has to come from **stitching many short
generated clips together**, in shot order, with transitions — an
editorial problem, not a generation one.

`buildTimeline(projectId, shots, clips, options)` does exactly that: it
takes the existing ordered `Shot[]` (already the source of truth for shot
order — this is a re-projection, not a second one) plus a pool of
externally-generated `ClipRef[]`, and produces a `Timeline` — an edit-
decision list with cumulative start times, per-shot transitions, and
total duration. A shot with no matching clip yet is reported in
`missingClips`, not thrown — a shotlist that's still generating is the
normal case, not an error.

This module does no generation, transcoding, or rendering itself — no
FFmpeg, no GPU call — same "no pixel pipeline" boundary the rest of this
package already holds to.

### Four repos that are the same idea, independently arrived at

`ArcReel`, `calesthio/OpenMontage` (AGPL-3.0 — noted, not vendored
regardless of stack), `HBAI-Ltd/Toonflow-app`, and `waooAI/waoowaoo` are
four separately-built full-stack apps that all converge on the same
shape: script/novel → consistent characters → storyboard → video, with
approval gates. None are vendored — wrong stack for three of the four
(Python/FastAPI, Next.js/MySQL, Next.js/MySQL against this TypeScript
package), and the fourth (Toonflow-app, actually TypeScript/Electron)
is a full desktop app, not a library. Treated as validation that this
package's `Shot` / `Entity.lockedTraits` / `ReferenceAsset` shape is the
right one — four independent implementations landed on it — not as four
things to integrate in parallel. If a real orchestrator UI is wanted
later, picking one of these (or building a thin one on top of this
package) is a separate decision, not made here.

### External adapter contracts (`src/external-adapters.ts`)

Four more pieces are genuinely useful stages this package cannot run
itself — Python/GPU/full-app, wrong runtime here. Rather than skip them
silently, each gets a TypeScript interface documenting the input/output
shape a real integration would need, so the assembly layer has a place
to plug into once one exists:

- `GenerationAdapter` — produces a `ClipRef` for a rendered prompt. Target
  is Seedance 2.0/Higgsfield (already what `emit.ts` renders for) or a
  self-hosted `Wan-Video/Wan2.2`.
- `LocalizationAdapter` — produces a `LocalizationTrack` (subtitles +
  dubbed audio) for a clip in one language. Modeled on
  `Huanshere/VideoLingo`'s actual output shape.
- `AvatarPerformanceAdapter` — an alternative to clip generation for
  dialogue-driven segments: a VRM avatar performance instead of a
  diffusion clip, not duration-capped the same way. Modeled conceptually
  on `dexvdev/svelte-vrm-live`; not fetched in detail this round (hit a
  fetch-tool rate limit), flagged rather than guessed at — worth a closer
  look before anyone builds against this interface for real.
- `ComicPanelAdapter` — a still-panel branch instead of video for a shot,
  sidestepping clip-length limits entirely. Modeled conceptually on
  `LingyiChen-AI/AIComicBuilder`; same caveat — not fetched in detail this
  round, worth confirming before relying on it.

`PixarAnimationStudios/OpenUSD` (also not fetched in detail — same rate
limit) and `animate-css/animate.css` were reviewed by reputation only:
OpenUSD is Pixar's 3D scene-interchange format, a heavy C++/Python SDK
relevant only if this pipeline needs true 3D asset interchange between
DCC tools — no lightweight TypeScript story, out of scope until that need
is concrete. `animate.css` is a plain CSS animation-class library for web
UI motion (fades, CTA button animation) — relevant to whatever renders
the finished ad on a web page, not to this package, which has no
ad-rendering UI surface to attach it to.

### Structural control (`ControlType` on `ReferenceAsset`) and touch-up

Two more repos, reviewed for the same "assembly line" question:

- `Mikubill/sd-webui-controlnet` is the standard way to constrain
  generation with more than text — pose skeletons, depth maps, edge
  maps, loose reference-only, color/style transfer. It's a Python
  AUTOMATIC1111 extension with no portable schema of its own, but the
  *taxonomy* is portable and was a real gap here: `GenerationAdapter`
  only carried a rendered text prompt, with no way to say "this
  reference is a pose skeleton, weight it at 0.8" — which is the actual
  mechanism character/pose consistency needs beyond what
  `Entity.lockedTraits` text can specify. `ReferenceAsset` now carries
  optional `controlType` (`ControlType` in types.ts) and `strength`;
  `emit.ts` surfaces it in the rendered `@material[...]` line (e.g.
  `pose control (strength 0.8)`) instead of a generic "reference" label
  when set, and falls back to the prior behavior when absent.
- `IrfanulM/BananaSlice` is a Tauri/React desktop app (MIT, actually
  TypeScript stack) for selective generative-fill — Adobe Generative
  Fill's idea, open source. Still not vendored (a standalone desktop
  app, not a library), but it named a real pipeline stage this package
  didn't have a contract for: fixing one bad region of an already-
  generated clip (a warped hand, a face artifact) instead of
  regenerating the whole shot. `TouchUpAdapter` in
  `external-adapters.ts` models that.

### What's actually needed to run any of this for real

This package can plan and assemble; it cannot generate a frame. To turn
`Timeline` output into an actual video, someone needs to decide:

1. **Generation**: self-host `Wan2.2` (GPU hosting — 24GB+ VRAM minimum)
   or call a hosted Seedance/Higgsfield API (account + cost model)?
2. **Localization**: which TTS/dubbing provider behind a
   `LocalizationAdapter` (VideoLingo supports Azure, OpenAI, GPT-SoVITS,
   Edge-TTS — needs picking and provisioning)?
3. **Orchestrator UI**: build a thin one on this package, or adopt one of
   ArcReel/Toonflow-app/waoowaoo wholesale (each is a real deployable app
   with its own DB/infra footprint)?
4. **Avatar and comic branches**: worth building `AvatarPerformanceAdapter`
   / `ComicPanelAdapter` implementations at all, or out of scope for now?
5. **Structural control**: does the real generation provider (Seedance/
   Higgsfield or self-hosted Wan2.2) even accept ControlNet-style
   conditioning inputs? If not, `ReferenceAsset.controlType` documents
   intent in the prompt text only, not enforced structural control — a
   real `GenerationAdapter` implementation needs to know which case it's
   in before `strength` means anything.

None of these are guessable from here — they're cost, infra, and product
calls.

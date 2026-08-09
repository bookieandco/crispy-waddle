# PupsonStuff — Static Boutique

## Milestone 6.5 — Hoodie/mug 3D orientation, actually fixed (not just newly confirmed wrong)

Milestone 6.3's live Playwright pass across all six products confirmed
something real: hoodie and mug both rendered visibly wrong in the
browser — a lying-down mound instead of an upright hoodie, a mug shown
rim-on instead of in profile. That pass stopped at confirming the bug,
not fixing it, since a real fix needed the same geometry-analysis rigor
their original (wrong) rotations were derived with. This pass did that.

Root cause, the same for both: `scripts/obj_to_glb.py` (the OBJ→GLB
conversion both meshes went through) does no axis conversion at all —
confirmed by reading its source, not assumed. Both original
`modelRotation` values (`[-π/2, 0, 0]`) were derived from an analysis
that concluded the source data needed a Z-up→Y-up correction — for the
mug, real cross-section-circularity math on the OBJ; for the hoodie, a
first-pass read of ambiguous matplotlib renders, explicitly flagged at
the time as unconfirmed. Directly re-measuring the actual
`public/models/{hoodie,mug}.glb` vertex data (not the OBJ, not a
render — the real exported bytes) shows both are **already Y-up**: the
hoodie's Y-extent (-0.439..0.460) dwarfs its Z-extent (-0.153..0.094,
correctly the thinnest axis for a garment); the mug's Y-extent
(0.005..0.100) is the base-to-rim height, with X/Z forming the ~0.08-wide
circular footprint. The documented -90° correction was flipping an
already-correct mesh onto its side in both cases — not a modeling
defect in either asset, a config bug.

Fixed: `modelRotation: [0, 0, 0]` for both. Re-verified live (Playwright,
not just re-reading the numbers): hoodie renders upright and front-facing
— hood, pocket, cuffs, hem all correctly placed; mug renders as a correct
vertical cylinder with the handle landing on the far side of the camera,
which was the original design intent all along, just reached via the
identity rotation instead of the wrong one. Both products' `printAreas`
were also recomputed for the corrected coordinate frame (the old decal
positions were computed for the now-removed rotation and would sit off
the mesh entirely) — real geometry (body-only point filtering to find
the true front-wall/chest-center coordinates), though the decal-on-
surface look itself still isn't confirmed against an actual generated
image (needs a live `OPENAI_API_KEY`/`MUAPI_API_KEY` run to test that
part, not available in this pass).

## Milestone 6.4 — Second AI provider (Muapi.ai): two new art styles

`lib/ai.ts` (OpenAI) stays the default path for the original 10 art
styles. Two new styles now route through a second, independent provider
instead — genuinely different capability, not a redundant duplicate:

- **`lib/muapi.ts`** (new): a Muapi.ai client (`upload_file` → submit to
  `/api/v1/{model}` → poll `/api/v1/predictions/{id}/result`). Muapi.ai's
  own docs domain is blocked by this environment's egress policy, so
  every endpoint/auth-header/request-body/response-shape detail here was
  verified against `Anil-matcha/Open-Generative-AI`'s actual working
  client source (`packages/studio/src/muapi.js`) — real running code, not
  paraphrased docs. Two things that source couldn't establish either
  (and the pricing/rate-limit pages were themselves unreachable to check
  directly): exact per-model pricing and any documented rate limit —
  stated as genuinely unknown in the code comments, not guessed at.
- **"Studio Ghibli"** (`ai-ghibli-style`): a fixed-effect style-transfer
  model — no prompt field at all, just the uploaded photo in, restyled
  photo out.
- **"Flux Dreamscape"** (`flux-kontext-pro-i2i`): prompt-driven, reuses
  the same `AI_PROMPT_TEMPLATE` + per-product prompt text the OpenAI path
  already builds, since this model takes a prompt too.
- New env var `MUAPI_API_KEY`, additive only — every pre-existing style
  still only needs `OPENAI_API_KEY`; these two are the only ones that
  need the new key.
- **Verified live** (not just built): both new style buttons render in
  the art-style picker, and with no `MUAPI_API_KEY` configured, both fail
  the exact honest way the OpenAI path already does for a missing key —
  a 502 with `{"success":false,"error":"MUAPI_API_KEY is not
  configured."}`, surfaced in the UI's existing error state, no crash.
  This is the same "fails honestly, not a silent fake result" bar every
  other AI integration in this project is held to — confirmed here via
  Playwright against a real running dev server, not assumed from reading
  the code. The actual generation call itself is untested against a live
  Muapi key, same caveat as every other unexercised AI call in this
  project (no network access to muapi.ai from the environment that wrote
  this) — test it for real before shipping.

## Milestone 6.3 — Bottle/tote real 3D models (Blender, local) + a genuine app-crashing bug fixed

The HF product-3D pipeline from 6.2 stayed blocked (huggingface.co and
*.hf.space both confirmed via real curl tests, not assumption). Rather than
leave `bottle`/`tote` without any 3D entry, both are now real, audited
`.glb` models — the third distinct sourcing method in this project after
the licensed shirt mesh and Stable-Fast-3D's hoodie output, alongside the
mug's manual-OBJ path.

- **`scripts/model_product_blender.py`** (new): procedurally models both
  products with Blender's Python API (`bpy`/`bmesh`) at real dimensions —
  20oz bottle (7.3cm diameter, 27.2cm total height) and a 38×42×10cm
  canvas tote — entirely offline, no network dependency at all. Two real
  bugs surfaced and fixed along the way, not just assumed away:
  - **Bottle**: `bpy.ops.object.join()` on three stacked primitives (body/
    neck/cap) merges mesh *data* but doesn't weld touching-but-not-
    coincident geometry — the audit caught 3 genuinely disconnected
    pieces. Rebuilt as a single bmesh spin/lathe revolve from one vertical
    profile instead — no seam to weld in the first place. Re-audited:
    100/100.
  - **Tote**: two more real bugs, both caught by checking actual vertex
    counts rather than trusting a render that "looked" fine —
    `primitive_cube_add(size=1)` spans ±0.5 (a first pass scaled by
    `dimension/2`, producing a half-size body), and
    `primitive_torus_add`'s default orientation is flat in the XY plane,
    not a vertical arch (a first pass's boolean union against the body
    found zero intersection, twice — confirmed a real no-op by identical
    vertex counts before/after, not a solver failure). Fixed: correct
    scale factor, and handles rotated 90° about X before being
    Boolean-unioned into the body. Re-audited: 98.8/100.
  - Both registered in `config/product3dModels.ts` with real, verified
    (not guessed) bounding-box math backing `modelRotation`.

- **A real, previously-undiscovered app-crashing bug**, found while
  actually driving bottle/tote through the live UI for the first time
  (not just checking that `next build` compiled): `Product3DEngine.tsx`'s
  `<Environment preset="city">` fetches an HDR file from an external CDN.
  When that fetch is blocked or fails, drei/three throws an uncaught
  error that crashes the *entire* Next.js app — "Application error: a
  client-side exception has occurred" over the whole page, not a duller
  product preview. This affected all six products (shirt, hoodie, mug,
  pillow, bottle, tote), not just the two new ones — it just took adding
  a product that forced an actual live-browser test to surface it.
  Fixed: removed `<Environment>` entirely (real three-point-ish light rig
  instead — a second, softer fill `directionalLight` compensates), and
  generalized the boutique room's error boundary
  (`BoutiqueSceneErrorBoundary.tsx` → `Scene3DErrorBoundary.tsx`) to wrap
  every 3D `<Canvas>` in this app, not just the room. A future flaky asset
  fetch now degrades to a "3D preview couldn't load" message inside that
  one component instead of taking the whole page down.

- **Verified live, not just built**: a Playwright pass (headless Chromium,
  `--use-gl=swiftshader`, iPhone 13 profile) opened all 9 hotspots covering
  all 6 products, switched each to "View in 3D", and confirmed a canvas
  renders with zero page errors and no app-crash text — for every product,
  not just bottle/tote.

- **A second real bug found by that same live pass, also fixed**: the
  bottle initially rendered cropped — camera looking at roughly the
  bottom half, cap cut off entirely. Root cause: `Product3DEngine`'s
  `ProductMesh` only ever reads a glTF node's raw `.geometry`, never its
  node-level translation. `tote_body`'s export happens to carry an
  unbaked node translation that gets silently dropped, and its *raw*
  vertex data happened to already be centered (only scale got baked via
  `transform_apply`, never location) — coincidence, not design, but
  correct anyway. Bottle's profile was built starting at z=0 with no equivalent
  offset, so its raw vertices spanned 0..0.272 uncentered, and
  OrbitControls' default (0,0,0) target sat at the bottle's *base*. Fixed
  at the source — the Blender profile now starts at `-total_height/2` so
  the vertex data that actually reaches the renderer is centered, the
  same way tote's turned out to be. Re-exported, re-audited (still
  100/100), re-verified live: full bottle silhouette — body, shoulder,
  neck, cap — now renders in frame.

- **Newly confirmed, not fixed**: that same live pass is also the first
  time hoodie and mug were ever actually seen rendering in a real browser
  rather than judged from static matplotlib renders. Both render
  visibly wrong — the hoodie shows a lying-down mound rather than an
  upright garment, and the mug shows its rim/opening face-on with the
  handle hanging below rather than a side profile. Their
  `modelRotation` values were already flagged in
  `config/product3dModels.ts` as first-pass estimates "not verified... 
  confirm once this actually renders in a browser" — that confirmation
  has now happened, and it failed. Not fixed here: correcting it needs
  the same real-geometry-analysis rigor the mug's *existing* rotation
  value was derived with (cross-section binning, not a guess), which is
  its own task, not a guess bolted on at the end of this one.

## Milestone 6.2 — ASCII art style (real, testable today) + HF product-3D pipeline (blocked)

Follow-up on Milestone 6.1's clarification: Hugging Face's job was 3D +
animation (animation done in 6.1; 3D-for-products is this pass), and the
other repo (`vietnh1009/ASCII-generator`) was for an asset — both a new
art style and a loading effect, per the user.

**ASCII Art style — the one piece of this whole AI-generation surface
that's actually fully verified, not just "real code, untested":**
`lib/ascii.ts` reimplements the same idea as the referenced Python repo
(deterministic pixel-brightness → character mapping) natively in
TypeScript rather than adding it as a Python dependency — same "JS/TS
equivalent" call already made for OpenAI and Hugging Face. Because it's
pure computation with **no external API and no key**, it's the one
generation path here that could be run for real: tested directly against
`lib/ascii.ts` (a synthetic image with a known shape rendered correctly
as recognizable ASCII), then again through the actual
`/api/generate-preview` route end-to-end (curl, real 200 response, real
decodable PNG), then again through the live UI (Playwright: selected
"ASCII Art" in the style picker, uploaded a photo, generated, got a real
result rendered in the modal — screenshotted). `types/boutique.ts` gained
an `ascii-art` style; the route branches on a new `artStyleId` field
(added alongside the existing label field, which OpenAI's prompt still
uses) to skip the OpenAI call entirely for this one style.

**Loading effect**: `components/AsciiSpinner.tsx` — a small braille-style
ASCII spinner (client-side interval, no dependency on lib/ascii.ts, just
the same visual language), swapped in for the product preview area
whenever `generating` or `animating` is true in `ProductModal.tsx`,
replacing the old plain "Generating…" button-text-only state.

**Hugging Face product-3D pipeline — built, not run.**
`scripts/generate_3d_from_image.py` is the missing first step for the two
products with no real mesh at all (`bottle`, `tote` — per
`config/product3dModels.ts`'s own long-standing comment): a reference
product photo in, a raw `.glb` out, via Stable Fast 3D (the same tool the
existing hoodie mesh already came from, per Milestone 5.2 — just scripted
here instead of done manually), feeding into the *existing*
`scripts/audit_glb.py` gate unchanged. Full write-up, including two real
blockers found while building it, in
`docs/boutique-design/product-3d-generation.md`:
1. No reference photo for bottle or tote exists anywhere in this repo —
   checked, not assumed.
2. **This sandbox's network policy blocks `huggingface.co` outright** —
   confirmed via `curl $HTTPS_PROXY/__agentproxy/status`, which logs a
   real rejected CONNECT (`policy denial`) to `huggingface.co:443`. That's
   a stronger, more specific caveat than "no API key configured, no
   network access to test with" (what `lib/ai.ts` and `lib/animation.ts`
   already honestly carry) — it means even a real `HUGGINGFACE_API_KEY`
   wouldn't let this run *from this particular sandbox*, though it should
   work fine from a normal deployment. Also means the exact
   `gradio_client` call in the script follows Stable Fast 3D's typical
   documented usage, not a live-confirmed one (`client.view_api()` was
   never reachable) — flagged in the script itself as needing a check
   against the live Space before trusting it.

`lib/animation.ts`'s own comment (Milestone 6.1) has been corrected to
name this same network block precisely, rather than the more generic "no
network access in the sandbox" it said before finding this.

## Milestone 6.1 — Marker polish + AI-animated portraits

Two separate pieces of follow-up work from Milestone 6.

**3D product marker polish** (`components/BoutiqueScene.tsx`,
`config/boutiqueShell.ts`):
- **Occlusion**: markers now hide when the room shell is physically
  between them and the camera, via drei's `Html occlude` prop pointed at
  a ref to just the loaded room mesh (`raycaster.intersectObjects`
  against one 234-triangle object, not drei's whole-scene "raycast" mode,
  which would test every object in the Canvas every frame). Wired up and
  running with no console/page errors across multiple camera angles — but
  stated honestly: this room's actual proportions (markers float above a
  fairly thin counter, walls are far apart, orbit is angle-limited) mean
  I couldn't manufacture a real screenshot where a marker actually
  disappears behind geometry to prove the occlusion visually fires, even
  after several orbit angles including deliberately extreme ones. The
  mechanism is real and correctly targeted; a genuine before/after
  occluded screenshot is still open.
- **Label overlap**: adjacent markers (e.g. "Throw Pillow" and "Geometric
  Mug", same rank-adjacent, same row) still crowded each other after
  Milestone 6's spacing fix. Fixed with a small alternating vertical
  offset per marker — tried a depth (Z) offset first, which barely helped
  (checked, not assumed: ~5px screen difference for 0.35m of Z, because
  the starting camera looks nearly level), then switched to a Y offset,
  which works directly on the axis that actually separates two
  horizontally-adjacent labels. Also shrank the marker's own footprint
  (smaller padding/font/dot). Verified by real screenshot + bounding-box
  check: all 6 in-frame markers now render with zero label overlap.

**AI-animated portraits** (`lib/animation.ts`,
`app/api/animate-preview/route.ts`, `components/ProductModal.tsx`):
Second step on top of the existing static portrait generation
(`lib/ai.ts`, OpenAI Images API) — once a static portrait exists, an
"Animate Preview" button sends it to Hugging Face's image-to-video task
(`@huggingface/inference`, the JS/TS SDK — matching the same "JS
equivalent, not the Python one" call already made for `lib/ai.ts`/OpenAI)
to produce a short looping video, using model `Wan-AI/Wan2.1-I2V-14B-720P`
(the SDK's own documented default for the task) with a prompt aimed at
subtle idle motion rather than dramatic movement. Shows up as a third
"Animated" tab in the modal's existing Flat/3D segmented preview control,
alongside a `<video autoPlay loop muted playsInline>` element.

Real, functional code — not a placeholder, same honesty standard as
`lib/ai.ts`. What's actually verified: the full request/response wiring
end-to-end against the real running dev server (input validation, data-URL
parsing, error propagation, the UI states for generating/error/success),
confirmed via direct API calls and a live Playwright session. What's
**not** verified, because no `HUGGINGFACE_API_KEY` is configured in this
environment (same situation `OPENAI_API_KEY` was in for `lib/ai.ts`): an
actual call to the model. `HUGGINGFACE_API_KEY` needs to be set before
this does anything beyond returning its own honest "not configured"
error — treat the first real run as a test, and expect the prompt/
`num_frames`/model choice to need tuning once real output exists to look
at, per `lib/animation.ts`'s own comments.

Also confirmed unbroken by this pass: switching `view3D: boolean` to a
`viewMode: "flat" | "3d" | "animated"` state didn't regress the existing
Flat Preview/View in 3D toggle for shirt/hoodie/mug/pillow — checked live
(opened a 3D-capable product, switched modes, canvas mounted correctly),
not just assumed from the diff.

## Milestone 6 — The boutique_shell.glb is now an actual explorable 3D room

The brief: turn `public/models/boutique_shell.glb` into a real, mobile-
viewable 3D boutique, without replacing the flat-photo experience — it
stays as the fallback. What follows is what got built, what got found
along the way (two real, pre-existing bugs neither this project nor its
own audit pipeline had caught, because nothing had ever actually loaded
this stack in a browser before), and what's honestly still open.

**Architecture — new, not duplicated:**
- `components/BoutiqueScene.tsx` — the environment-level 3D scene. Loads
  `boutique_shell.glb` via `useGLTF` (same pattern as `Product3DEngine`),
  adds real Three.js lighting, renders product markers, and hands off taps
  to the exact same `onSelect` callback the flat 2D `Hotspots` component
  already used — no second product renderer, no duplicate `ProductModal`.
  Tapping a marker opens the real `ProductModal`, which still lazy-loads
  the real `Product3DEngine` for the tapped product exactly as before —
  confirmed live (tapped "Geometric Mug" from inside the 3D room, got the
  same modal with its own Flat/3D toggle).
- `config/boutiqueShell.ts` + `config/boutiqueShellMeta.json` — the latter
  is now emitted by `scripts/build_boutique_shell.py` itself (real room
  dimensions, the counter's box, and every light head's real world
  position), so the decorative geometry and the numbers used to place
  actual Three.js lights/markers around it can't drift apart. The former
  adds the genuinely-new, explicitly-first-pass piece: 7 product markers
  hand-placed in 3D, ordered by each hotspot's real photo-space x%
  (RANK-based spacing, not raw-value — several photo x%s sit within a
  couple points of each other and raw mapping put their markers on top of
  each other, caught by an actual screenshot, not assumed).
- `components/BoutiqueSceneErrorBoundary.tsx` + `lib/webgl.ts` — real
  feature detection (an actual throwaway `getContext('webgl')` call, not
  an assumption) plus a real React error boundary around the 3D scene.
  `Boutique.tsx` now holds a `mode: "3d" | "flat"` state: defaults to 3D
  only when WebGL actually checks out, and both a WebGL-detection failure
  and a runtime scene error (bad GLTF parse, lost context, etc.) fall back
  to the ORIGINAL flat photo + hotspot rendering, not a blank screen — the
  user can also switch modes manually at any time via a bottom-left
  toggle. All verified live (see Testing below), not just written to spec.

**Lighting — real, not decorative-geometry-as-light:**
The room's real dimensioned floor/ceiling/walls/counter/track-lighting
geometry from Milestone 5.9 is unchanged. What actually illuminates it:
ambient + hemisphere fill, plus 2 real point lights positioned at real
track-rail head coordinates from `boutiqueShellMeta.json` (one per rail,
not one per decorative head — 12 real-time lights is real GPU cost a phone
shouldn't pay for illumination the room doesn't need that granularly), plus
one warm point light near the counter matching the photo's "register area"
glow. No `shadows` prop on this Canvas (unlike `Product3DEngine`'s
per-product one) — a full room's real-time shadow maps is cost this
environment-level scene deliberately doesn't spend.

**Two real bugs found by actually rendering this — not caught by any
prior audit, because nothing had ever loaded this stack in a browser:**

1. **The whole three.js/R3F stack was incompatible with this Next.js
   version.** Next.js 15's App Router aliases `react`/`react-dom` to its
   own internally vendored React (19.2.0-canary) for the client bundle,
   regardless of what's pinned in this project's own `package.json` —
   confirmed by reading `node_modules/next/dist/compiled/react`'s own
   version string. `@react-three/fiber@8.x` depends on the external
   `react-reconciler@0.27.0` package, built for React 18-era internals;
   loading it under React 19 threw `Cannot read properties of undefined
   (reading 'ReactCurrentOwner')` on every mount, caught live by the new
   error boundary and silently falling back to flat mode — which is
   exactly why this had never been noticed: earlier milestones' own notes
   already say "no browser in the sandbox that built this." Fixed by
   upgrading the whole stack to its React-19-native generation: `three`
   0.150→^0.170, `@react-three/fiber` 8.18→^9.4 (which vendors its own
   reconciler now, no more external `react-reconciler` dependency at all),
   `@react-three/drei` 9.58→^10.7, `react`/`react-dom`→^19. One real
   knock-on fix: drei 10's `Decal` dropped the `depthWrite` prop (it was
   never actually reaching the decal's material even before this — not
   namespaced as `material-depthWrite` — so nothing regressed by removing
   it). This wasn't scope creep — it was blocking `Product3DEngine` for
   every existing product (shirt/hoodie/mug/pillow) just as much as the
   new boutique scene; fixing it was required to honestly claim either one
   works.
2. **The floor and ceiling quads had inverted winding**, computed to
   normals facing away from the room. Both were backface-culled and
   invisible — the top and bottom of every render showed the page's `bg-
   ink` background color through what looked like a black void, not the
   warm wood floor / dark ceiling the color values said they should be.
   `audit_glb.py`'s checks don't catch this (winding doesn't change
   vertex/triangle counts or degenerate-triangle detection) — only an
   actual render caught it. Fixed in `scripts/build_boutique_shell.py`
   (vertex order swap on both quads), regenerated, re-audited (same
   70/100 — winding doesn't affect the score either, confirming the fix
   didn't touch anything the audit was already measuring).

Also fixed, found the same way (a real thrown `pageerror` during testing,
not a lint warning): `context/MusicContext.tsx`'s volume fade could
compute a value a hair outside `[0, 1]` from ordinary float accumulation
— `audio.volume`'s setter throws on that, not clamps. One-line clamp fix.
Pre-existing, unrelated to this milestone's own code, but it was a real
uncaught error surfacing in the same session.

**Testing — what was actually verified, and how:**
Ran the real dev server and drove it with Playwright + the repo's
pre-installed Chromium (software WebGL via SwiftShader — see Known
limitations). Checked, with real assertions against a running page, not
just "it builds":
- 3D scene loads, reaches ready state, no console/page errors.
- Starting camera position shows the room with 5-6 of 7 product markers
  in frame on an iPhone-13-sized viewport (390×664 CSS px) — fixed
  overlap and off-screen markers through two real iterations (rank-based
  spacing, narrower placement band, wider FOV), each verified by an actual
  screenshot + bounding-box check, not eyeballed once and assumed good.
- Touch-style drag (pointer down/move/up, the same events OrbitControls'
  default touch mapping listens to) moves the camera without erroring.
- Tapping a 3D product marker opens the real `ProductModal` — screenshotted
  and confirmed (`Geometric Mug`, $22.00, Flat/3D toggle, Add to Cart).
- Closing the modal returns to the 3D scene, canvas still mounted.
- Mode toggle switches to "Photo View" and the original flat hotspot flow
  still opens the modal — existing functionality confirmed unbroken, not
  assumed unbroken.
- WebGL forced unavailable (canvas.getContext patched to return null
  before page scripts run) → 3D mode is never attempted, no toggle shown,
  flat photo + all 18 hotspots render normally. Real fallback, verified,
  not just written to satisfy the spec.
- Desktop viewport (1400×900) sanity-checked separately — full room
  visible, 6/7 markers unobstructed.

**Known limitations — stated plainly, not glossed over:**
- **Real iPhone/mobile-GPU performance was NOT measured.** Everything
  above ran through headless Chromium's software WebGL renderer in this
  sandbox — there is no physical phone in this environment. Design
  choices that should help (`dpr` capped at 1.75, no shadow maps on the
  room canvas, only 3 real lights, the shell itself is only 234 triangles)
  are reasoned, not benchmarked. Don't take this milestone's word for
  "smooth on an iPhone" — that claim isn't backed by a real device test.
- **Marker occlusion isn't implemented** — product markers render through
  walls/the counter from any angle (`occlude={false}` on drei's `Html`,
  explicit tradeoff for reliability over polish this pass).
- **Marker placement is still hand-tuned, not measured** — same honesty
  as Milestone 5.9's shell dimensions. Good enough to be legible and
  roughly ordered like the photo; not a precise 3D reconstruction of
  anything.
- **One marker ("Black Hoodie") sits partly outside the starting frame**
  by design tradeoff — it's the rightmost product in the photo, and fully
  fitting it in view would have meant compressing all 7 markers into an
  even narrower band. Reachable via the same look-around control being
  tested, not invisible.
- **Pinch-zoom specifically wasn't isolated in a touch-only test** —
  Playwright's touch APIs don't include a pinch gesture, only tap. What
  WAS verified: `OrbitControls`' `touches` prop is explicitly configured
  (`ONE: ROTATE, TWO: DOLLY_ROTATE`), which is the standard three.js touch
  mapping pinch-to-zoom relies on — the same mechanism, not independently
  re-tested end-to-end with real pinch input.
- **Entrance/storefront still open** — per the brief, not blocked on
  `public/boutique-entrance.png`; unchanged from Milestone 5.9.

## Milestone 5.9 — Mug fixed + approved, evidence answered, first boutique shell built

Picked up right where 5.8 left off: the user answered the three MUST HAVE
evidence items, and separately, the mug's NEEDS_FIXES finding from 5.5 got
a real fix instead of staying parked.

**Mug: NEEDS_FIXES (80/100) → APPROVED (90/100).** The 260 zero-area
triangles flagged in 5.5 (real degenerate geometry, not a triangulation
artifact — already ruled that out) are gone: `scripts/
fix_degenerate_triangles.py` drops triangles below the audit's own
zero-area threshold without moving or removing a single vertex, so nothing
else about the mesh changed. Re-audited clean at 90/100 (remaining -10 is
5 pre-existing non-manifold edges, informational, unrelated to this fix).
Moved to `assets/approved/`, re-registered in `config/product3dModels.ts`.

One more real thing came out of fixing it: the audit's own matplotlib
renders make the mug look tipped on its side, which could've been
mistaken for an orientation bug. It isn't a rendering bug to fix in the
mesh — direct vertex-cloud analysis (binning positions along each axis and
measuring how circular the perpendicular cross-section is) shows the
mesh's real cylinder axis is Z, not Y, meaning this OBJ source is Z-up
like the hoodie's Stable Fast 3D export was — same fix, same
`modelRotation: [-Math.PI / 2, 0, 0]`. Handle-offset analysis then placed
the handle on the far side once rotated, which is where the registered
print area now sits. Wired into `ProductModal.tsx`'s `mugColorful`/
`mugWhite` hotspots, which had no 3D toggle until now.

**Evidence request, all three MUST HAVE items answered:**
1. Scale anchor: 10ft (3.048m) standard retail ceiling height.
2. Entrance/storefront: generate a matching concept image rather than
   describe or skip it. No image-generation tool exists in this
   environment, so `docs/boutique-design/entrance-concept-prompt.md` is a
   ready-to-run prompt instead, built from the interior's own established
   materials/lighting/branding — not generated yet, waiting on the user to
   run it through the same generator that made `public/boutique.png`.
3. Real vs. AI-generated: confirmed AI-generated concept image — both from
   the user directly and from actually looking at `public/boutique.png`
   itself (the ceiling treatment, mixed art styles, and total absence of
   any storefront in frame all read as generated-concept markers).

**First boutique environment shell, built and audited**
(`scripts/build_boutique_shell.py` → `public/models/boutique_shell.glb`,
full writeup in `docs/boutique-design/boutique-shell-v1.md`). Real
floor/ceiling/walls/counter/track-lighting geometry, dimensioned off the
real 10ft ceiling anchor, with real per-face UVs (unlike the retired
`boutique_proxy.glb`, which had none). Audits at 70/100 NEEDS_FIXES — the
only deduction is expected multi-object fragmentation (19 separate
architectural volumes), not a real defect the way missing UVs and
zero-area triangles were for `boutique_proxy.glb`; the writeup explains
why that score doesn't mean the same thing here. **Not wired into any
component yet** — `Boutique.tsx` still renders the flat photo + 2D
hotspots; turning this into an actual explorable scene is real future
work, not implied by the file existing. Also: `boutique_proxy.glb` was
never actually a PupsonStuff reconstruction attempt (it's a proxy of the
*unrelated* reference blueprint room) — the writeup untangles the naming
confusion between the two files.

Also added: `.gitignore` for this app (none existed — `node_modules`/
`.next`/`__pycache__` were one `git add .` away from getting committed).

## Milestone 5.8 — Evidence Request (what's actually needed next)

`docs/boutique-design/evidence-request.md`. The real finding: the MUST HAVE
list is short — three items, not ten. (1) A scale anchor — one real
dimension, since a single photo has zero absolute scale and everything
built without one will be proportionally right but dimensionally
arbitrary. (2) Entrance/storefront direction — genuinely absent from both
the photo (not in frame) and the reference library, the one true blank
slate. (3) Confirmation of whether the boutique photo is a real
photographed space or an AI-generated concept image — changes whether
"more evidence" means going to take photos or making new creative/generation
decisions, and the original master prompt's framing suggests the latter.
Everything else (walls, floor, ceiling shell, counter paneling, lighting
placement) is buildable procedurally right now from what's already
established, blocked only by item 1.

## Milestone 5.7 — Reference Gap Analysis

`docs/boutique-design/reference-gap-analysis.md` — cross-references the
real reference library against the real photo observations, with strict
DIRECT/TRANSFERABLE/ANALOGOUS/UNSUPPORTED labeling. Headline finding: real
coverage exists for lighting construction logic, small hardware patterns,
and — specifically — the checkout counter's computer/monitor (the photo
shows one, the reference has `IMAC_keyboard`/`IMAC_21`, a genuine visual
correspondence, not just a category match). Zero coverage exists for the
entire architectural envelope — walls, floor, storefront, doors, windows —
which is the highest-priority gap since it's what's visible in nearly every
frame of the photo. No new assets acquired yet, per the instruction to stop
at the gap analysis first.

## Milestone 5.6 — reference-knowledge library + real photo analysis

Reframed per the last message: the 231-object extraction isn't a failed
boutique model, it's reusable 3D knowledge. Built the concrete part of that
reframing — not the full described pipeline (see caveat below).

- **`reference_knowledge/`** — the same real 231-object data, reorganized
  into semantic categories (lighting, hardware, furniture, structure) by
  actual object-name pattern matching, not invented. 91 hardware objects,
  20 lighting objects, 31 structural-mass objects, 84 unclassified
  (`generic_geometry`) rather than force-categorized.
- **Real construction pattern recovered**: track lighting = a long thin
  rail object + repeated small head objects mounted along it. Genuine,
  transferable knowledge independent of exact source dimensions.
- **`docs/boutique-design/reference-knowledge-and-photo-analysis.md`** —
  fresh visual analysis of the actual boutique photo (structure, spatial
  relationships, visual language — all directly observed, not reused from
  the earlier living-room analysis), plus honest cross-referencing: the
  reference library's lighting construction pattern is genuinely relevant
  to the photo's visible track lighting; its color/material data is
  flagged as probably just wireframe display colors, not trustworthy
  material info; its one chair and its display-island proportions don't
  meaningfully connect to anything in this specific photo.
- **Explicit scope line**: the full "Reference-to-Scene Reconstruction"
  pipeline (photo segmentation, spatial relationship graphs, procedural
  generation, automated render-vs-photo iteration) is NOT built. No
  segmentation model, procedural mesh generator, or automated visual-diff
  loop exists in this environment. That's real future architecture, not a
  delivered capability — flagged clearly rather than implied.

## Milestone 5.5 — mug converted + audited, two files flagged as not usable yet

Three files came in. One was directly useful, two weren't ready:

- **`11oz-Mug.zip`** — no `.glb` inside (just `.blend`/`.fbx`/`.obj`/`.stl`),
  so `scripts/obj_to_glb.py` was written: a manual OBJ+MTL → GLB converter
  (no `trimesh`/Blender CLI available offline). First conversion produced
  260 zero-area triangles; tried the standard fix (split each quad along
  its shorter diagonal instead of a fixed one) — **made no difference,
  which is itself the useful finding**: it proved the issue isn't the
  triangulation choice, it's near-duplicate vertices already in the source
  quads (localized to a few spots, likely the interior cavity or handle
  seam). Perspective render shows a genuinely good mug — real interior
  cavity, real handle geometry, correct proportions. Pipeline's own
  threshold puts it at **NEEDS_FIXES (80/100)** — filed to
  `assets/needs-review/`, not promoted to approved just because the shape
  looks good. Both files: `scripts/obj_to_glb.py` (reusable for the next
  OBJ-only asset) and `public/models/mug.glb`.
- **`Shirt.mtl`** — a lone CLO/Marvelous Designer material file, no
  geometry, references a texture at an absolute path that doesn't exist
  here. Not usable alone; needs its companion `.obj`/`.fbx` + the actual
  texture file.
- **`Slidable_4_Panel_Door.zip`** — a real BlenderKit sliding-door asset
  pack (11 file formats + a Blender turntable MP4), but it's a raw
  untextured CG asset with no person in it — the accompanying request
  assumed a human-interaction reference to analyze (hand placement, wrist
  rotation, weight shift), which doesn't exist in this file. Also
  unrelated to PupsonStuff's product catalog either way. Not integrated;
  flagged rather than forced to fit.

## Milestone 5.4 — third real asset (pillow), and what it actually exposed

Got a real third .glb (`Pillow_W.glb`, home-decor category — not the mug/
hat/canvas suggested, but a genuine different category, and the only real
file that came through). Ran it through the same pipeline rather than
adding more planning docs.

- **Approved, 100/100.** 2,170 vertices, 3,840 triangles — lighter than
  shirt/hoodie, good for mobile. Clean topology, single connected surface,
  correctly oriented with no rotation fix needed (unlike the hoodie).
- **Real new failure mode found, exactly the point of testing another
  category**: this asset's units are ~100x larger than the shirt/hoodie's
  (bounding box ~109×42×108 vs. their ~0.2–0.9 range) — a different source
  pipeline, different unit convention. The pipeline's camera-distance
  heuristic compensated automatically (each product renders in its own
  isolated `<Canvas>`, so this wasn't visually broken), but there was no
  `modelScale` field in `Product3DConfig` to actually normalize it — added
  one. Doesn't matter yet with isolated per-product previews; would matter
  a lot if products ever share one 3D scene.
- **Self-correction on my own visual read**: my first look at the renders
  read as "nice fabric weave texture." That was wrong — this material has
  no base color or normal texture at all, just a flat gray factor. What
  looked like weave was the audit renderer's flat shading showing the
  mesh's own triangle density, not a real texture. Corrected in
  `asset-audits/scores/pillow.json` rather than left standing. The
  silhouette quality is genuinely good; the material readiness is not —
  it'll render flat until a texture or the generated portrait decal gives
  it visual interest.
- Wired into `ProductModal.tsx` — the `pillow` hotspot now gets the 3D
  toggle alongside the shirt/hoodie ones.

## Milestone 5.3 — reusable 3D Asset Audit Pipeline

Turned the one-off hoodie audit into `scripts/audit_glb.py`, a real
reusable tool (full details: `asset-audits/README.md`), and ran it against
both real assets in the project.

- **Both approved**: hoodie 99.8/100, shirt 100/100. Full reports, 5-angle
  renders, and scores for each are in `asset-audits/`.
- **A real bug caught in the pipeline's own first draft**: the config
  generator initially pulled the mesh name from `mesh.name`, but
  `@react-three/drei` actually keys `nodes` by *node* name — the shirt
  asset has `mesh.name == "Mesh"` but its node is `"T_Shirt_male"`. A
  config built the naive way would have failed to load. Fixed by
  resolving the node that references the mesh instead.
- **What's honestly not automated**: visual quality ("does this look like
  a real hoodie") is a written assessment from actually looking at the
  rendered PNGs, not a fabricated score — there's no honest way to compute
  that from vertex data. Rotation and print-zone placement in every
  drafted config are always marked `NEEDS_REVIEW` for the same reason — a
  script can't confirm a decal lands on the chest and not a sleeve.
- **"Test against 3 additional categories" — couldn't, honestly.** There
  are exactly 2 real .glb files anywhere in this project (shirt, hoodie).
  No mug/shoe/other category asset exists yet. The pipeline ran against
  every real asset available rather than fabricating results for
  categories that don't exist — upload 3 more real files and it'll run
  against those too.

## Milestone 5.2 — real hoodie mesh + generic Product3DEngine

You uploaded a real .glb (audited in `docs/asset-audits/hoodie-glb-audit.md`
— worth a read, it corrects a couple of things from the ChatGPT transcript
that came with it, including its "biggest concern" turning out to not be
one). Short version: it's a genuine hoodie mesh, not a placeholder, and
it's now integrated.

- **`public/models/hoodie.glb`** — the audited asset, patched with real
  mesh/material names (`hoodie_body` / `hoodie_material`) so config-driven
  lookup works. This is the hoodie mesh that's been missing since the
  shirt model got integrated — hoodie hotspots finally get a real 3D
  preview instead of flat-only.
- **`components/Product3DEngine.tsx`** — replaces the old hardcoded
  `Product3DPreview.tsx` per your roadmap. Takes a `Product3DConfig` (see
  `config/product3dModels.ts`) instead of assuming any specific model —
  register a new product by adding a config entry, not writing a new
  component. Supports multiple named print areas per model (front/back/
  sleeve/etc — only "front" populated for both models today, since that's
  all that's been verified against the actual meshes).
- **Plugin architecture is real, not just an interface** —
  `components/product3d-plugins/screenshotPlugin.tsx` is one working
  plugin (downloads a 2x-resolution PNG of the live 3D view via
  `lib/product3d/screenshot.ts`), proving the extension seam works. Text-
  to-3D and AR are NOT built — this is just where they'd plug in later,
  per your own note not to rely on text-to-3D for retail-accurate apparel
  yet.
- **Known limitation, stated plainly**: the engine only handles
  single-mesh, single-material .glb files. Both registered models happen
  to fit that. A garment with separate meshes per panel needs this
  extended.
- **Not yet confirmed**: the hoodie's corrective rotation and chest decal
  placement are first-pass estimates from static renders, not a live
  Three.js session (no browser in the sandbox that built this) — first
  thing to check once you run `npm install && npm run dev`.

## Milestone 5.1 — 3D shirt preview added

You sent 4 zips looking for usable 3D assets. Two were dead ends
(`Clothes-3D-master` and `CLOTH3D-main` are just papers/docs, no actual
models). Two were real and got integrated:

- **`public/models/shirt_baked.glb`** — a real T-shirt mesh, sourced from
  "3D T-Shirt Modeling Customizer" by Divyansh Saxena, **MIT licensed**
  (checked — safe for a commercial product).
- **`components/Product3DPreview.tsx`** — adapted from that project's
  `Shirt.jsx`: a live-rotating Three.js/React Three Fiber preview that
  projects the generated portrait onto the garment's chest as a real
  texture decal, not a flat overlay.
- Wired into `ProductModal.tsx` as a "Flat Preview / View in 3D" toggle —
  **only for `concertShirt` and `foldedShirts`**, the two real tee
  products. **This mesh is a T-shirt, not a hoodie** — no hood, drawstring,
  or pocket geometry — so the hoodie hotspots stay flat-preview-only. Making
  it actually look like a hoodie needs a hoodie-specific mesh, which wasn't
  in any of the 4 zips.
- The 4th zip, `3D-Clothing-Configurator-master`, has more features (front
  *and* back logos, text) but **ships with no LICENSE file at all** — so
  none of its code got reused here. Worth tracking down its real license if
  those extra features are worth having later.
- New deps in `package.json`: `three`, `@react-three/fiber`,
  `@react-three/drei`, `maath`, `@types/three`. Run `npm install` before
  this will build.

**Heads up on continuity**: the Milestone 6 work from a couple messages back
(the sequential single-product highlight system, replacing the dual glow
layers, plus decoupling hotspots from product data into a proper inventory
layer) was still in progress when this 3D-asset detour started, and it
didn't get saved before the build environment reset. This zip is back on
Milestone 5's foundation, not Milestone 6 — that work needs to be redone
from scratch whenever you're ready for it.

## Milestone 5 — Product Interaction Update

Your "Product Interaction Update" spec — the big one. What shipped, and
what's honestly still open:

**Done:**
- `lib/silhouettes.ts` — real shape templates (bottle, mug+handle, shirt/
  hoodie, tote, pillow, frame). Automatic contour tracing (OpenCV GrabCut)
  was tried first and discarded — it kept finding noisy, wrong shapes
  against this photo's backgrounds even after two different seeding
  strategies. These are hand-fit instead: real silhouettes, positioned by
  inspecting the actual photo pixels, not a circle or box.
- **The product IS the hotspot now** — `Hotspot.tsx`'s clickable area is
  `clip-path`'d to the silhouette itself. Clicking/tapping outside the
  shape (but inside its bounding box) does nothing.
- **Pillow fixed** — was covering the chair and armrest; now hugs the
  actual cushion (re-measured against the photo).
- **Drinkware split** — was one shared hotspot over 3 items; now `bottle`,
  `mugColorful`, `mugWhite` are independently clickable.
- **Wall art split** — was one `gallery` box over 6 frames; now `frame1`
  through `frame6`, each independently clickable, each keeps its own art
  style/prompt.
- **Real product glow, not a decoration** — `backdrop-filter` clipped to
  the silhouette, same technique as Milestone 4.1, now shaped correctly
  instead of an ellipse.
- **Two ambient layers**, per spec: an always-on subtle breathing aura on
  every product simultaneously (1.25s cycle, low opacity, screen-blended,
  blurred so it bleeds a few px past the edge), plus a faster guided-tour
  flash+rings that sweep through all 16 products in sequence (0.3s apart,
  matching your example cadence) to guide the eye around the store.
- **Hover** — 1.03 scale, 3px lift, drop-shadow, stronger brighten.
- **Mobile tap** — 100ms scale pulse before the panel opens.
- `/api/generate-preview` — the AI route, renamed and re-payloaded to match
  this spec exactly (`productId`, `artStyle`, `cropPosition`), same real
  OpenAI call underneath (moved, not rebuilt). Panel now has the full
  Generate → Generate Again / Approve → Add to Cart flow, with a retry
  button on failure instead of a dead end.
- Inventory architecture — already existed as of Milestone 2/3
  (`fulfillment` on each hotspot); nothing needed rebuilding here.

**Not done, on purpose:**
- **Hats and the wall sign** — no established bounding boxes for these yet.
  Rather than guess at placement, they're left out. Send a crop or point me
  at their rough location and I'll add them properly.
- **"Then repeat randomly"** — the guided tour repeats in a fixed order,
  not truly randomized each lap. Pure CSS (no JS interval) can't
  re-shuffle at runtime; true randomization needs a small JS scheduler
  instead. Say the word if that matters enough to add.
- The `pupsonstuff-preview.html` phone file mirrors all of this (silhouette
  clip-paths, both glow layers, corrected hotspots) so you can feel it on
  your phone before digging into the code.

## Milestone 4.1 — correction

Milestone 4's ping was still a colored shape drawn *over* the product — an
"ember spot," as you put it, not the product actually glowing. Fixed:

- The mask now uses `backdrop-filter: brightness()/saturate()` instead of a
  radial-gradient fill. That filter operates on whatever's *behind* the
  element — the boutique photo itself — so it genuinely brightens the
  product's own pixels. Nothing is painted on top of it anymore.
- The ripple rings now start at `scale(1)` — the product's own size — and
  expand outward from there, instead of starting as a small dot in the
  middle and growing. It reads as the product's own edge radiating, not a
  decoration floating near it.
- Shape is still an approximate rounded-rect/ellipse (`border-radius` from
  `roundness` in `data/hotspots.ts`) until real per-product cutout masks
  exist — that limitation hasn't changed, only what happens inside the mask
  has (brightening the real photo vs. drawing a colored shape).
- One caveat worth knowing: `backdrop-filter` isn't supported in every
  browser (older Firefox versions in particular). Modern Chrome, Safari,
  Edge, and current Firefox are fine. If you need to support older
  browsers, this would need a fallback — flag it if that matters for your
  audience.

## Milestone 4

You sent a GIF reference (sonar-style pulsing rings, Indomie loading
animation) and asked for the ambient "trying to be noticed" effect to look
like that, radiating outward from the product. Rebuilt it:

- `lib/lifeGlow.ts` — new shared timing module. A bright core flash plus 3
  concentric rings expand outward from each product's center, well past its
  own bounds, then fade. Keyframe percentages are computed from the actual
  hotspot count, not hand-tuned, so they stay correct if you add/remove
  products later.
- `components/ProductGlow.tsx` — renders the core + rings (SVG), each ring
  offset by 0.15s from the last for the concentric "sonar" look, still pure
  CSS/GPU-driven underneath — no JS interval.
- Each product still gets its own turn in sequence (now every 1.4s instead
  of the previous 0.4s — the slower pace gives the multi-ring animation room
  to actually read before the next product's turn starts), Checkout still
  excluded.
- Hover behavior is untouched — that's still the fast, separate pulse from
  Milestone 3.
- `pupsonstuff-preview.html` mirrors the same effect for phone testing.

## Milestone 3

You sent a "V2" master prompt for this pass. It conflicted with earlier
decisions in a few places — noted here rather than silently overridden:

- **Printify vs. Printful**: the V2 doc assumes Printify; your actual
  accounts are Printful. Kept Printful. `data/hotspots.ts` was refactored
  from a `printful`-shaped field to a provider-agnostic `fulfillment: {
  provider, productId, variants, printArea }`, so switching providers later
  (or mixing them per-product) is a data change, not a code change.
- **"Not placeholder" AI backend**: `app/api/generate-art/route.ts` +
  `lib/ai.ts` are real, functional code — actual validation, actual
  `fetch()` call to OpenAI's Images API, actual env var pattern. It hasn't
  been exercised against a live key (no network access in the sandbox that
  built it), so treat the first real run as a test. `ProductModal.tsx`
  calls this route for real now; it'll show an honest error until
  `OPENAI_API_KEY` is set, rather than faking a result.
- **Autoplay music**: true autoplay-on-load isn't something browsers allow
  with sound, and it also contradicts the original spec ("do not
  autoplay"). Built the reconciled version: music starts on the very first
  click/tap/keypress anywhere on the page, so visitors don't have to find
  the button — but nothing plays before they've touched the page at all.
  Volume dropped to 12% and fade extended to 3s per the V2 numbers.
- **Staggered "life" glow** replaces the random idle-breathing from
  Milestone 2: each product now takes a deterministic 0.4s turn glowing, in
  sequence, forever (`components/ProductGlow.tsx` + the `.life-glow`
  keyframes in `app/globals.css`) — pure CSS, GPU-accelerated, no JS
  interval. Checkout is excluded.
- **Hover state matches spec**: 1.03 scale, 2px lift, a small shadow, and a
  brighter hover aura than the life glow.
- **Glassmorphism panel**: backdrop blur on both the overlay and the panel
  surface; panel now also shows description and estimated delivery from the
  hotspot's inventory data.
- **True polygon masks / traced silhouettes**: still not built — still
  blocked on not having per-product cutout art to trace paths from.
- **Pinch-zoom/drag/mobile gestures**: not built this pass, held for its
  own milestone rather than bolted onto this one.

## Milestone 2

Same codebase, same hotspot coordinates, nothing recreated. This pass:

- **Organic hover/idle aura** replaces the rectangular glow.
  `components/ProductGlow.tsx` now renders an elliptical SVG mask sized per
  product via a new `auraRoundness` field in `data/hotspots.ts` (0 = boxy
  canvas, 1 = round mug), so a mug's glow doesn't look like a canvas's.
  Real per-product traced silhouettes are still the eventual goal — this is
  a meaningfully better approximation, not the final shape.
- **Centralized product data**: `data/hotspots.ts` now carries each
  hotspot's fulfillment product/variant IDs (placeholders — swap in real
  catalog IDs once synced), pricing, its slice of the AI Prompt Template,
  and its size/color customization options. `ProductModal.tsx` reads all of
  it straight from the clicked hotspot — nothing is hard-coded per product
  in the modal anymore.
- **Boutique Music**: `context/MusicContext.tsx` + `components/
  MusicToggle.tsx`. Floating bottom-right control, volume remembered in
  localStorage, and a duck-count so the panel being open *and* active
  generation can both request ducking without fighting each other.
  **No audio file was provided in this session** — drop your track at
  `public/music/boutique-theme.mp3` (see `public/music/README.txt`) and
  playback works immediately; everything else (fade, duck, memory) is
  already live.

## Fixed in Milestone 1.1

- **Hotspot alignment bug**: `BoutiqueImage` and `Hotspots` used to sit in
  separate boxes (`aspect-[3/2]` on the image vs. `inset-0` on the hotspot
  layer one level up). At viewport sizes where `object-contain` letterboxed
  the photo, the two boxes could render at different sizes and hotspots
  would drift off their products. Fixed by giving `Boutique.tsx` one shared
  container — sized to the photo's exact 1568:1003 ratio — that both the
  image and the hotspot layer fill identically.
- Added `next.config.ts` (was missing).
- Added `next-env.d.ts` (was missing; Next.js regenerates this on first
  `dev`/`build` anyway, but it's included so the project type-checks
  immediately on a fresh clone).

## What's built today

The homepage: your real boutique photo, full-screen and responsive, with all
ten hotspots from your spec wired up and data-driven from `data/hotspots.ts`.

- `data/hotspots.ts` — the single source of truth for every hotspot position.
  Move a shelf in a new photo later, update coordinates here only.
- `components/BoutiqueImage.tsx` — the photo itself, `object-contain` so it's
  never cropped or stretched, centered at any screen size.
- `components/Hotspot.tsx` / `Hotspots.tsx` — invisible zones, 102% scale +
  gold glow on hover (200–250ms, no bounce), click opens the panel.
- `components/ProductGlow.tsx` — the SVG-masked glow. Right now it's a
  rounded-rect mask (inset glow, not a hard rectangle outline). When you have
  real per-product cutout shapes, swap in traced paths here for a
  pixel-accurate highlight per item.
- `components/ProductModal.tsx` — the slide-out panel: preview, photo upload,
  10 art styles, quantity, Generate Preview, See It in the Boutique, Add to
  Cart. Generate Preview now calls the real `/api/generate-art` route.
- `app/api/generate-art/route.ts` + `lib/ai.ts` — real OpenAI Images API
  call, server-side only. Needs `OPENAI_API_KEY` to actually return art.

Brand tokens (cream/honey-oak/bronze/ink/greige) live in
`tailwind.config.ts`, sampled from your real store.

## Roadmap (build one milestone at a time)

1. **Foundation** — done (this repo).
2. **Interactive boutique polish** — real per-product SVG glow masks
   (current glow is a rounded-rect inset, not traced to product edges yet).
3. **AI portrait generation** — `/api/upload`, `/api/generate`: Supabase
   Storage → OpenAI Images API using the AI Prompt Template → stored artwork
   URL. `lib/supabase.ts` and `lib/ai.ts` get built here.
4. **Live product previews** — Konva.js compositing onto each product's
   transparent mockup (`/api/mockup`), instant re-preview on style/product/
   color change without another AI call.
5. **Shopping cart + checkout** — cart drawer, `/api/cart`, Stripe Checkout.
6. **Printful automation** — Stripe webhook → `/api/orders` → Printful order
   creation, `lib/printful.ts`.
7. **User accounts + order history** — Supabase Auth, order lookups.
8. **Final polish** — boutique music control (bottom-right, off by default,
   fades in over 2–3s, remembers volume, ducks during generation), lazy
   loading, production build check.

Tell me which milestone to build next and I'll work from this exact
codebase — same components, same hotspot coordinates, nothing recreated.

## Running it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000. You'll need Node 18.18+ and the packages
in `package.json` (Tailwind, Framer Motion pinned; `openai` and
`@huggingface/inference` are in since Milestone 6/6.1 — Konva/Supabase/
Stripe/Printful still get added when I build their features).

Copy `.env.example` to `.env.local` and fill in real keys before
exercising `/api/generate-preview` or `/api/animate-preview` — both
return an honest "not configured" error without them, rather than faking
a result.

## Deploying (Vercel)

1. Push this repo to GitHub.
2. Import into Vercel.
3. Add the env vars from `.env.example` — `OPENAI_API_KEY` and
   `HUGGINGFACE_API_KEY` as of Milestone 6.1, plus `MUAPI_API_KEY` as of
   Milestone 6.4 (only required for the "Studio Ghibli"/"Flux Dreamscape"
   styles — every other style still only needs `OPENAI_API_KEY`).

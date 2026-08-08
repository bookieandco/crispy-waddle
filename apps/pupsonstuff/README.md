# PupsonStuff — Static Boutique

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
in `package.json` (Tailwind, Framer Motion pinned; Konva/Supabase/Stripe/
Printful/OpenAI SDKs get added when I build their features in Phase 2 so
this install stays lean for now).

## Deploying (Vercel)

1. Push this repo to GitHub.
2. Import into Vercel.
3. Add the env vars from `.env.example` once Phase 2 backend routes exist —
   nothing required for Phase 1 to deploy as-is.

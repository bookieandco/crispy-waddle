# PupsonStuff Boutique Blueprint — Study Reference Analysis

**Reference**: one image (IMG_1209), a rendered luxury living/kitchen/dining
space — a real estate or interior-design portfolio screenshot, not the raw
FBX (still unparseable — see prior notes). This is the only reference
available; the "second interior for comparison" from earlier never arrived,
so this is a single-reference study, not a comparison.

Everything below is either (a) something actually visible in the image, or
(b) an explicit design recommendation built from it. Nothing here describes
copying the layout, furniture, or branding — the goal per the original ask
is principles, not replication.

---

## 1. What's actually in the reference

Observed directly:

- **Open-plan zoning, one sightline.** Kitchen island, living seating area,
  and a dining nook are all visible from a single vantage point, separated
  by function rather than walls. The eye travels naturally from the TV
  wall → seating → kitchen bar → dining table without a hard stop anywhere.
- **A backlit vertical display shelf** beside the kitchen (glass-front,
  internally lit, holds bottles/objects) — the single most directly
  transferable idea in this image. It's a narrow, illuminated, glass-fronted
  column that turns ordinary objects into something that reads as curated.
- **Layered lighting, four distinct sources**: a coffered ceiling with warm
  LED cove lighting and a mirrored center panel that bounces light back
  down; adjustable track spotlights aimed at specific spots (the display
  shelf, the artwork); a sculptural pendant over the dining table; wall
  sconces at seating height. No single light source is doing all the work.
- **Material contrast, not material variety.** The palette is narrow
  (cream, taupe, warm wood, brass) but contrast comes from *texture*:
  glossy marble waterfall island next to matte cabinetry, tufted bouclé
  sofa next to a black-framed window wall, a mirror panel next to a stone
  fireplace surround.
- **Black metal framing as the one hard-edged accent** — window mullions,
  fireplace surround, thin shelf frames — against an otherwise soft, warm,
  rounded material palette. It's a small amount of contrast doing a lot of
  the "this feels designed" work.
- **A fireplace as a secondary focal anchor**, separate from the TV wall —
  the seating area has two things to look at, not one.

## 2. Materials — what's real vs. what's assumed

Real (visible): warm-toned marble/stone with visible veining, dark wide-
plank wood flooring, brushed brass/gold metal fixtures, black powder-coated
metal framing, boucle/tufted upholstery, a large mirror panel.

Not verifiable from a photo (roughness/reflectivity exact values, texture
tiling scale, whether surfaces are PBR-authored or baked) — any numeric
material spec below is a recommendation for PupsonStuff's own materials,
not a measurement of this image.

## 3. Recommended PupsonStuff material library

| Surface | Material direction | Why |
|---|---|---|
| Product shelving/display frame | Warm oak or walnut veneer, satin (not gloss) | Matches your existing boutique photo's honey-oak/bronze palette already established in `tailwind.config.ts` |
| Accent hardware (rails, hooks, frame trim) | Brushed brass, roughness ~0.35, non-metallic-adjacent | The one "hard shine" accent — small doses, like the reference's black metal |
| Feature product display niche | Backlit, translucent or frosted panel behind, warm 2700-3000K LED | Directly adapted from the reference's bottle-display shelf — this is the one technique worth actually building |
| Floor | Matte, warm-toned wood, larger plank scale to avoid tiling artifacts at boutique-room scale | Avoids the "obviously repeating texture" tell at typical camera distances |
| Walls | Flat matte, warm greige — let products and lighting be the contrast, not the walls | Reference uses the same restraint; walls recede, objects pop |

## 4. Lighting strategy for a Three.js/WebGL boutique

Direct translation of the reference's 4-layer lighting into web-renderable terms:

1. **Ambient/fill** — low-intensity, warm-tinted `HemisphereLight` or soft
   `ambientLight`, just enough that nothing goes pure black. This is the
   cove-lighting equivalent — invisible as a "light" but sets the mood.
2. **Directional key** — one soft-shadowed directional or large-area light,
   standing in for the coffered ceiling's diffuse glow.
3. **Spotlights on hero products** — this is the important one. The
   reference's track lighting deliberately points at specific objects (the
   display shelf, the art). For PupsonStuff: a `SpotLight` per featured
   product hotspot, not a uniform wash — reinforces "this is what you
   should look at" the same way the guided-tour glow already does visually.
4. **A single warm accent light** near checkout/portrait-studio — the
   pendant-light equivalent, marking "something happens here" the way the
   dining pendant marks the dining zone.

## 5. Product display strategy (the part that actually transfers to commerce)

- **One item, not a shelf, gets the backlit-niche treatment.** In the
  reference, the whole shelf is backlit uniformly. For a retail read (draw
  the eye to *this specific thing*), PupsonStuff should reserve backlighting
  for a single rotating "featured product" spot — scarcity of the effect is
  what makes it a signal instead of wallpaper.
- **Group by function, not by grid.** The reference's zones (cook, dine,
  relax) each read instantly. PupsonStuff's existing hotspot layout already
  does this loosely (wall art / apparel / drinkware clusters) — worth
  keeping that zoning explicit rather than flattening into a uniform grid
  as more products are added.
- **Two focal points, not one.** The reference gives the seating area both
  a TV wall and a fireplace — two reasons to look somewhere. PupsonStuff's
  current single "hero wall" (the framed portraits) could pair with a
  second anchor elsewhere in the room (the register/checkout area is the
  natural candidate, since it's already a distinct zone) so the eye has two
  places to land, not just one.

## 6. 3D/WebGL build requirements this implies

- A `SpotLight`-per-hotspot pattern in the eventual full 3D boutique scene
  (not built yet — this is a spec for when the 2D hotspot boutique becomes
  a true 3D walkthrough).
- One additional reusable component: a "backlit niche" material/geometry
  pair (frosted panel + warm point light behind it) for the single featured-
  product slot.
- Texture budget: given the mobile-performance constraints already
  established for the product .glb pipeline, environment materials should
  stay in the same 1-2K resolution range already used for product textures
  — no reason for the *room* to be heavier than the *products* customers
  actually came to look at.

## 7. What this is NOT

Not a layout to copy. Not a furniture list. Not a floor plan. This is a
short list of *why* the reference photo reads as premium (layered light,
narrow material palette with texture contrast, one deliberate glowing
focal display, restrained hard-edge accents) translated into things
PupsonStuff can actually build, most of which layer on top of the boutique
photo/hotspot system that already exists rather than replacing it.

# Boutique Entrance — Concept Image Generation Prompt

Resolves MUST HAVE #2 from `evidence-request.md`: zero evidence exists
anywhere in this project for what PupsonStuff's entrance/storefront looks
like — not in the boutique photo (not in frame) and not in the reference
library (a different, unrelated space). Per the user's answer, this gets
resolved with a new AI-generated concept image, run through the same
generator that produced `public/boutique.png`, rather than by measuring or
photographing anything (there's nothing physical to measure — the boutique
photo itself is confirmed AI-generated concept art, not a photographed
real space).

Revised and expanded from the first pass: added a negative-prompt block,
a text-rendering caveat (AI image generators reliably garble storefront
sign text — worth knowing going in, not discovering after three failed
generations), two additional prompt variants for different real uses, and
an honest reconciliation with the actual dimensions `build_boutique_shell.py`
already committed to, which the first pass's aspect-ratio suggestion didn't
account for.

## Why a prompt document instead of a generated image

No image-generation tool is available in this environment. What follows is
ready-to-run prompts, written to match the *established* interior as
closely as text can — same material palette, same lighting language, same
brand elements already fixed by `public/boutique.png` — so whatever comes
back has the best chance of reading as the same building seen from
outside, not a different store.

## What the prompts are built from (real, established constraints)

Pulled directly from `reference-knowledge-and-photo-analysis.md`'s photo
analysis, not invented for this document:

- **Materials**: honey-oak wood tones, black metal, cream/white wall
  surfaces, one black accent surface. No marble, no brass.
- **Lighting**: warm-white color temperature throughout, track spotlighting
  rather than uniform wash — matches the "focused pools of light" language
  already used for the interior.
- **Branding**: the "PupsonStuff" wordmark + puppy mascot logo visible on
  the interior's black accent wall (`public/boutique.png`) is the one
  concrete brand asset that should reappear on the storefront signage —
  everything else about the exterior is genuinely new creative direction,
  not a re-ask for something that already exists.
- **Category signal**: a premium/personalized pet-product boutique — the
  storefront should read that way at a glance (a passerby should be able
  to guess "pet store, upscale, not a big-box chain" without needing to
  read the sign).

## Reconciling this with the 3D shell's real dimensions

`scripts/build_boutique_shell.py` already committed to real numbers for
the room this entrance belongs to: `ROOM_WIDTH = 9.0` (X), ceiling height
`3.048` (10ft, the one *confirmed*, not assumed, scale anchor), and the
storefront is the open `+Z` face — intentionally left as a gap in the mesh
specifically because this evidence didn't exist yet (see its comment at
the `z1` face).

That face's real aspect ratio is **9.0 : 3.048 ≈ 2.95 : 1** — much wider
and flatter than a 16:9 (1.78:1) or 3:2 (1.5:1) photo crop. The first pass
of this document suggested 16:9/3:2 to match `boutique.png`'s framing,
which is fine for a **mood/reference image** (the same role `boutique.png`
plays for the flat photo view — a hero shot, not literal 3D texture data)
but would need heavy stretching or cropping to actually skin that 9m-wide
gap. Two honest options, not resolved by this document alone:

1. Generate the 16:9/3:2 "hero" version below for the mood-board/reference
   role, and treat modeling real storefront geometry (glass, door, sign,
   awning as actual meshes in the shell script) as separate follow-up work
   that *uses* this image as style reference — the way the interior shell
   already translates the flat photo's material language into geometry,
   rather than projecting the photo itself onto a wall.
2. If a literal texture-mapped facade is wanted instead, use the "wide
   facade" variant below (already framed close to the real 2.95:1 ratio)
   and expect to still crop/extend it — no single AI generation will land
   exactly on an arbitrary aspect ratio.

This document doesn't pick between the two; whoever runs these prompts
should pick based on what's actually being built next.

## Negative prompt (use with all three variants below)

Most image generators (this project's own generator included, per how
`lib/ai.ts` calls it) support an explicit negative/avoid list. Worth
supplying one every time here, since these are the failure modes that
would actually break continuity with the established interior:

```
cool blue lighting, fluorescent lighting, marble, brass, gold trim,
chrome, big-box chain store signage, neon signage, cartoonish mascot,
visible people, pedestrians, cars, cluttered street scene, nighttime,
graffiti, worn/dirty facade, generic strip-mall storefront, blurry text,
warped logo
```

## A known limitation worth stating plainly: sign text

AI image generation is unreliable at rendering legible, correctly-spelled
text — "PupsonStuff" on a sign is exactly the kind of short brand string
these models frequently garble (extra/missing letters, warped kerning).
Don't burn generations chasing perfect sign text in one shot. Two realistic
paths, either is fine:

- Generate the storefront with signage *implied* (a blank or illegibly-
  detailed sign panel/awning in the right place, right material) and
  composite the real wordmark from `public/boutique.png`'s existing asset
  onto that panel afterward — reuses a brand asset that's already correct
  rather than re-generating it and hoping.
- If a tool-specific "text-to-image with reliable typography" mode is
  available in whatever generator ends up running this, use it just for
  the sign, keep the rest of the scene from the main prompt.

## Variant 1 — Main hero (16:9 / 3:2, mood/reference role)

```
A photorealistic architectural exterior/storefront concept for
"PupsonStuff," a premium boutique pet-product store, street-level retail
entrance. Style-matched to an existing interior: honey-oak wood accents,
black metal framing, warm cream/white facade, warm-white (not cool/blue)
exterior lighting. Large glass storefront window with a visible interior
glimpse (wood shelving, warm lighting) rather than a solid wall. Black
metal-framed glass entrance door, centered or slightly off-center. Storefront
sign: "PupsonStuff" wordmark in a friendly, modern sans-serif, paired with
a small illustrated golden-retriever-puppy mascot icon (round, friendly,
simple shapes) — the sign should feel warm and premium, not cartoonish or
big-box. Awning or overhead sign element in black metal or dark wood,
matching the interior's black-accent-wall material language. Sidewalk-level
view, eye height, slight upward angle. Soft late-afternoon or early-evening
lighting, warm ambient glow from the interior visible through the glass.
Minimal, upscale streetscape context (a few feet of adjacent sidewalk/
storefront, not a full street scene) so the PupsonStuff entrance is the
clear subject. No visible people. 16:9 or 3:2 aspect ratio to roughly match
the existing interior image's framing.
```

## Variant 2 — Wide facade, straight-on (~2.95:1, matches the shell's real open face)

For the "literal texture" path above. Same material/lighting language,
reframed to a flat, straight-on elevation rather than a perspective hero
shot — closer to an architectural elevation drawing's camera than a
street photo, which is what a texture for a flat wall-sized opening
actually needs:

```
A photorealistic, straight-on architectural elevation view (not a
perspective street photo — flat, orthographic-feeling framing, camera
perpendicular to the facade) of "PupsonStuff," a premium boutique
pet-product storefront. Very wide, short aspect ratio (roughly 3:1) — a
full shopfront width, single story, centered horizontally in frame with
minimal margin above/below the building line. Honey-oak wood accents,
black metal framing, warm cream/white facade, warm-white exterior
lighting. One large glass storefront window spanning most of the width,
warm-lit wood shelving visible through the glass. Centered black
metal-framed glass entrance door. Storefront sign band above the window:
"PupsonStuff" wordmark, modern sans-serif, small golden-retriever-puppy
mascot icon beside it, black metal or dark wood surround matching the
interior's black accent wall. No sky, no ground/sidewalk texture beyond a
thin strip, no adjacent buildings — isolate the facade itself so it reads
cleanly as a single flat surface. No visible people, no vehicles.
```

## Variant 3 — Evening/night ambiance (16:9 / 3:2, optional mood alternate)

Same building, different time of day — useful if the flat photo view or
marketing ever wants a second, moodier hero image without re-deriving the
whole material language from scratch:

```
Same "PupsonStuff" premium boutique pet-product storefront as the main
hero concept (honey-oak wood, black metal, cream facade, glass storefront
window, centered glass entrance door, "PupsonStuff" wordmark + puppy
mascot sign, black metal/dark wood awning) — reframed for early evening,
after sunset. Deep blue dusk sky, NOT full black night. Warm-white interior
lighting glowing through the storefront glass is now the dominant light
source, plus warm-white exterior sign/awning lighting — no cool blue or
neon light anywhere on the building itself, only in the ambient dusk sky
behind it. Sidewalk-level view, eye height, slight upward angle. No
visible people. 16:9 or 3:2 aspect ratio.
```

## What to do with the result

1. Save the output as `public/boutique-entrance.png` (not yet referenced by
   any component — nothing wires it in automatically). If more than one
   variant gets generated, suffix by variant (`boutique-entrance-hero.png`,
   `boutique-entrance-facade.png`, `boutique-entrance-evening.png`) rather
   than overwriting.
2. This project's own scope, once at least the hero variant exists: it
   becomes the evidence that resolves MUST HAVE #2, unblocking real (not
   placeholder) storefront treatment for the boutique shell built in
   `scripts/build_boutique_shell.py` — see "Reconciling this with the 3D
   shell's real dimensions" above for why that's follow-up modeling work
   informed by this image, not a direct texture swap, unless the facade
   variant is used and still expect to crop/extend it.
3. If a generated image doesn't actually match the interior's material/
   color language well enough on inspection, that's a real finding worth
   coming back with — regenerate rather than force a mismatched result
   into the project. Sign text specifically: expect to composite it in
   separately per the caveat above rather than treating a garbled
   generation as a failure of the whole image.

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

## Why a prompt document instead of a generated image

No image-generation tool is available in this environment. What follows is
a ready-to-run prompt, written to match the *established* interior as
closely as a text prompt can — same material palette, same lighting
language, same brand elements already fixed by `public/boutique.png` — so
whatever comes back has the best chance of reading as the same building
seen from outside, not a different store.

## What the prompt is built from (real, established constraints)

Pulled directly from `reference-knowledge-and-photo-analysis.md`'s
photo analysis, not invented for this document:

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

## The prompt

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

## What to do with the result

1. Save the output as `public/boutique-entrance.png` (not yet referenced by
   any component — nothing wires it in automatically).
2. This project's own scope, once that file exists: it becomes the
   evidence that resolves MUST HAVE #2, unblocking a real (not placeholder)
   storefront section for the boutique shell built in
   `scripts/build_boutique_shell.py` — currently that shell's storefront
   side (+Z) is deliberately left as an open gap, exactly because this
   didn't exist yet.
3. If the generated image doesn't actually match the interior's material/
   color language well enough on inspection, that's a real finding worth
   coming back with — regenerate rather than force a mismatched result
   into the project.

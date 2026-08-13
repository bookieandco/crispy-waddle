# Boutique Reconstruction — Evidence Request

Answers one question: what do I actually need from you to move from
analysis into a first-pass 3D reconstruction of THIS boutique. Every item
below is tied to a specific gap in what the photo or the reference library
actually shows — nothing here is a generic asset shopping list.

## 0. One question that changes what "more evidence" even means

**Is the boutique photo a real physical space, or an AI-generated/concept
image?**

This isn't a formality — it determines what kind of evidence request makes
sense. If it's a real space: more photos, a tape measure, and manufacturer
spec sheets are all real things that exist and can be obtained. If it's an
AI-generated concept image (which the original master prompt describes it
being used as — "the boutique image is the source of truth," treated as a
fixed background asset rather than a photographed location): there is no
real storefront to go photograph, no real wall to measure, and — important
— no guarantee the image is even internally consistent on scale, since
image generators are known to be unreliable about real-world proportion.
In that case, "additional evidence" means new creative direction from you
(generate/describe what the entrance looks like), not documentation of
something that already physically exists.

I'm proceeding on the assumption it's the latter (AI-generated concept,
consistent with how it's been used throughout this project) unless you
tell me otherwise. Everything below is written for that case; if it's
actually a real space, several "NICE TO HAVE, new creative direction"
items below become "MUST HAVE, just go photograph/measure it" instead —
worth confirming since it changes the actual ask.

## 1. What I can already determine from the photo alone — no new reference needed

- **Wall color** (cream/white side walls, one black accent wall) —
  directly visible, extractable as exact pixel color.
- **Floor tone and general material impression** (warm-toned wood plank) —
  visible, though "is it real hardwood vs. LVP vs. laminate" isn't
  determinable from a photo regardless of source, and doesn't need to be
  for a 3D representation — visual match is enough.
- **Lighting fixture count and rough placement** — the visible track
  lighting positions and approximate spacing can be read directly off the
  ceiling in frame.
- **Relative proportions between objects in frame** — the armchair vs.
  table vs. rack sizes relative to each other are inferable from the
  photo's own perspective, even without absolute measurements.
- **Color/material language overall** (honey-oak wood, black metal, cream
  walls) — already captured in `docs/boutique-design/reference-analysis.md`
  and `reference-knowledge-and-photo-analysis.md`.

None of this needs a new asset. It needs to actually get built into
geometry/materials, which is separate downstream work, not a reference gap.

## 2. What's fundamentally absent from BOTH sources — the real gap

Storefront, door, and windows are not just UNSUPPORTED in the reference
library — **they're not in the photo either.** Zero evidence exists
anywhere in this project for what PupsonStuff's entrance looks like. This
is categorically different from "walls" or "floor," where the photo at
least gives real color/material evidence even without a matching 3D
reference — for the entrance, there is nothing to go on at all.

## 3. Prioritized request list

### MUST HAVE

| # | Item | Why necessary | What I need | Provenance if unfulfilled |
|---|---|---|---|---|
| 1 | **A scale anchor** | A single photo has no absolute scale. Everything reconstructed will be *proportionally* right and *dimensionally* arbitrary without one real measurement or a stated real-world dimension (e.g. "the ceiling is 10ft," "the center table is a standard 30in-high table"). This affects literally everything else — it's the one item that blocks accurate reconstruction of what's already fully visible. | One stated real-world dimension for anything in frame — ceiling height, table height, door width if there is one, anything. | REQUIRED EVIDENCE |
| 2 | **Entrance/storefront concept direction** | Zero evidence in photo or reference library. Can't reconstruct what was never shown. | If real space: a photo of the entrance. If concept: your creative direction (or a new AI-generated concept image) for what the storefront/entrance looks like. | UNSUPPORTED / NEEDS NEW EVIDENCE |
| 3 | **Confirmation of the assumption in section 0** | Changes whether "more evidence" means photography or creative generation for several other line items below. | A direct answer: real space or concept image? | REQUIRED EVIDENCE |

### NICE TO HAVE

| # | Item | Why useful (not blocking) | What I need | Provenance |
|---|---|---|---|---|
| 4 | **A second angle of the same room** | Resolves what's behind/beside the current camera position — right now the room's actual depth and full wall extents are inferred from one vanishing point, not confirmed. Improves accuracy, doesn't block a first pass. | Another photo/render from a different angle of the *same* boutique, if one exists. | ANALOGOUS (would upgrade several UNSUPPORTED rows if it exists) |
| 5 | **Track lighting fixture reference appropriate to THIS photo's style** | The reference library's Zumtobel Arcos knowledge is real but generic — the photo's actual fixture heads have a visible shape/finish that could be matched more specifically. Not blocking: the reference's rail+head *construction pattern* is already usable without this. | A photo or product reference of track lighting matching the visible style, OR permission to approximate from the existing reference pattern. | TRANSFERABLE (already sufficient without this; this would upgrade toward DIRECT) |
| 6 | **Checkout counter construction reference** | The photo shows dark wood-slat paneling on the counter — a specific, identifiable material treatment not covered by the reference library's `IMAC_keyboard`/`IMAC_21` computer-only correspondence. | A close-up photo/reference of the slat paneling, or explicit confirmation to approximate it procedurally (repeated vertical wood strips, straightforward to build without a reference asset). | UNSUPPORTED for the counter body; TRANSFERABLE for the computer on top of it |

## 4. What can be built procedurally, with no new asset at all

- **The wall/floor/ceiling shell as flat, colored geometry** — walls and
  floor are large flat surfaces with a known color/material impression
  already established from the photo. This doesn't require a 3D reference
  asset to build; it requires deciding on real-world dimensions (blocked
  only by the scale anchor in item 1).
- **The checkout counter's slat-wood paneling** — a repeated vertical-strip
  pattern, straightforward procedural geometry, doesn't need a reference
  model.
- **Track lighting rail+head placement** — the reference library already
  provides the real construction pattern (rail + repeated heads); building
  a simplified version of that pattern doesn't require acquiring anything
  new, just using what's already in `reference_knowledge/lighting_reference.json`.

## 5. What stays ANALOGOUS/UNSUPPORTED even after the MUST HAVE items are resolved

Getting items 1-3 doesn't fully resolve display island, furniture, or small
hardware — those remain ANALOGOUS/LOW-MEDIUM at best without dedicated
reference material for those specific object categories, per the existing
gap analysis. Not requesting new assets for those now, per your instruction
— flagging only so it's clear the MUST HAVE list doesn't silently upgrade
everything else.

## 6. The smallest practical set that unblocks a first-pass reconstruction

Just the three MUST HAVE items. Nothing else in this document is required
to start building an architecturally-accurate (if materially generic) first
pass of the boutique shell — walls, floor, ceiling, lighting placement, and
counter, all buildable from what's already established once there's one
real scale number and a decision on the entrance.

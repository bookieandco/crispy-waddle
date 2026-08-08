# Boutique Reconstruction — Photo as Ground Truth, Reference Asset as Knowledge

## What this document is and isn't

This is the concrete, buildable piece of the reframed pipeline: a real
reference-knowledge library extracted from the source OBJ (grounded, not
fabricated), plus genuine visual analysis of the actual boutique photo,
plus honest cross-referencing between the two where they actually connect.

**What this is NOT**: the full "Reference-to-Scene Reconstruction" pipeline
described (automated photo segmentation, spatial relationship graphs,
procedural asset generation, automated render-vs-photo comparison with
iteration). None of that is built. I don't have a photogrammetry/scene-
segmentation model, a procedural mesh generator, or an automated visual-
diff-and-revise loop available in this environment. That remains a
described future architecture — real to aspire to, not something to assume
exists after this document.

---

## 1. Reference knowledge library (real, extracted from the OBJ)

`reference_knowledge/` — built from the same 231-object streaming
extraction as before, now reorganized and categorized:

| File | Contents | Count |
|---|---|---|
| `semantic_objects.json` | Every object, categorized | 231 |
| `measured_dimensions.json` | Real bounding-box dimensions per object | 231 |
| `bounding_box_library.json` | Real min/max/center per object | 231 |
| `material_color_library.json` | Unique colors actually observed, usage counts | 20 |
| `lighting_reference.json` | Track-light/spotlight objects | 20 |
| `furniture_patterns.json` | Chair objects | 1 |
| `hardware_patterns.json` | Adaptor/connector/bracket objects | 91 |
| `retail_display_patterns.json` | Island/structural-mass objects | 31 |

Categorization is name-pattern-based on the exporter's own object names
(e.g. `01_Zumtobel_Arcos_track003` → lighting) — a real signal from the
source file. 84 objects didn't match a known pattern and are labeled
`generic_geometry` rather than force-categorized; 2 are `uncategorized`
honestly.

**One real caveat on the color data**: the extracted RGB values (e.g.
`[198, 225, 87]`, a bright green) are almost certainly the exporter's
wireframe/viewport display colors, not the fixtures' real materials —
common in CAD visualization exports where helper/reference geometry gets a
distinct bright color for editing visibility. Worth knowing before treating
any of these as "the real material color."

**Real construction pattern recovered**: the track lighting objects show a
genuine two-part structure — long thin rail objects (`spotlight008`: 3.2 ×
300.4 × 3.4, `spotlight`: 531.8 × 4.0 × 2.0) plus small individual head
objects (`01_Zumtobel_Arcos_track`: 10.1 × 3.2 × 12.3, repeated ~10 times)
mounted along them. That's a real, transferable construction pattern —
track + repeated adjustable heads — independent of exact dimensions.

## 2. The boutique photo — genuine visual analysis

**Structure** (what's actually visible):
- A single continuous room, one camera position, no visible doors or
  windows in frame — can't confirm entrance location from this photo alone.
- Ceiling: exposed black-painted structure with visible ductwork, track
  lighting mounted directly to it (not recessed/coffered) — a deliberately
  industrial-adjacent ceiling treatment, different from the reference
  asset's fixture construction but the same *category* of object.
- Floor: continuous wood plank, unbroken across the visible space —
  no visible zoning breaks (rugs, level changes) except the round jute rug
  under the armchair.

**Spatial relationships** (what's actually visible):
- Left wall: framed wall-art grid (6 frames, 2×3) over an apparel rack,
  with an armchair/pillow vignette in the near-left foreground.
- Center-back: a dark accent wall with the logo, functioning as the visual
  anchor of the whole room — the one wall that isn't cream/neutral.
- Center-foreground: a table displaying grouped smaller products (mugs,
  bottle, hats, folded shirts) — the piece closest to the implied customer
  position, at a scale that reads as "browse this first."
- Right wall: open shelving (drinkware/hats) over a hanging rack, with a
  wall-mounted screen/monitor showing rotating product images.

**Visual language** (what's actually visible):
- Track lighting is real and visible — multiple fixture heads along the
  ceiling, aimed down at specific display zones rather than uniform wash.
  This is the one place the reference asset's real construction pattern
  (rail + repeated adjustable heads) is directly relevant: the photo shows
  the *effect* of that construction (focused pools of light on the wall art
  and the register area) without showing the fixture's own construction —
  the reference asset is genuine evidence for how to build a 3D version of
  what the photo only shows the lighting *result* of.
- Warm-white color temperature throughout, no visible cool/blue light.
- Materials read as: honey-oak wood tones (shelving, table, floor), black
  metal (rack frames, ceiling), cream/white walls, black accent wall.
  No visible marble/stone, no visible brass — a different material
  language than the earlier living-room reference, worth not conflating
  the two.

## 3. Where the reference library actually helps vs. doesn't

**Helps**: the track lighting construction pattern (rail + repeated heads)
is real, transferable knowledge for building a 3D version of what the
photo's ceiling lighting is doing. The retail-display-island structural
pattern (`retail_display_patterns.json`) is potentially relevant if
PupsonStuff's center table is modeled in 3D later — real construction
proportions for a similar-scale retail furniture piece.

**Doesn't help** (being honest about the limits): the reference asset has
no material data worth trusting (see caveat above), no chair relevant to
this photo's armchair (1 chair object, a different design entirely), and
nothing about wall-art framing, apparel racking, or the register/counter
construction visible in the photo — those would need their own reference
material or original design work, not this asset.

## 4. What's actually next, concretely

Not the full automated pipeline. The next real, buildable step in this
direction would be: model one thing (the track lighting) in 3D using the
reference asset's real rail+head construction pattern, scaled and colored
to match what's actually visible in the photo, as a single reusable
component — not simplified from the source mesh, not fabricated from
nothing, but *informed by* real reference construction and matched to real
photo evidence. That's a scoped, honest, buildable task, unlike the
open-ended "reconstruct the whole boutique from a photo" ask.

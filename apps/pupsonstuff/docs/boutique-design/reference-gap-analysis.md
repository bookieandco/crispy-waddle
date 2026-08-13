# Reference Gap Analysis

Cross-references `reference_knowledge/` (real, extracted from the source
OBJ) against the boutique photo's actual observed features (from
`reference-knowledge-and-photo-analysis.md`). Every row is grounded in
those two documents — nothing here is a new claim about either source.

## Provenance labels (applied strictly)

- **DIRECT** — the reference asset contains this specific thing.
- **TRANSFERABLE** — the asset demonstrates a construction/mounting
  pattern that reasonably informs the boutique feature, even without the
  exact object.
- **ANALOGOUS** — same general category, but not enough evidence to claim
  the construction is actually similar.
- **UNSUPPORTED** — no reference evidence exists for this feature at all.

## The matrix

| Boutique feature | Provenance | Confidence | Basis |
|---|---|---|---|
| Track lighting | TRANSFERABLE | MEDIUM | Reference has real `01_Zumtobel_Arcos_track*` + `spotlight*` objects showing a genuine rail+repeated-head construction pattern. That pattern is real and transferable. The *specific fixture* is not confirmed as what's in the photo — extracted color data is likely just wireframe display color, not real material — so this stops short of DIRECT. |
| Ceiling mounting relationship | TRANSFERABLE | MEDIUM | The reference's track-to-ceiling mounting relationship is architecturally generic and real; the photo shows lighting mounted directly to an exposed structural ceiling, which is consistent with (not proof of) the same mounting logic. |
| Display island / center table | ANALOGOUS | LOW-MEDIUM | Reference has `retail_display_patterns.json` (31 structure_mass objects incl. `vm_v3_059_mall_island`) — same *category* (central retail display furniture), but no verification the island's actual construction resembles the photo's simple wood table. Bounding-box scale alone isn't construction evidence. |
| Checkout / register | TRANSFERABLE | MEDIUM | Reference has `IMAC_keyboard` + `IMAC_21` (technology category). Photo shows an actual desktop computer/monitor on the counter — a specific, real visual correspondence, not just a category match. Still not DIRECT: construction of the counter itself (the photo's wood-slat paneling) has no reference support. |
| Small hardware (brackets, connectors, mounting hardware) | TRANSFERABLE | MEDIUM | Reference has 91 real hardware objects (`adaptor*`, small `Obj3d66_*` components) — genuine small-hardware modeling patterns exist, useful for shelving/rack construction generally, though not verified against the photo's specific rack/shelf hardware. |
| Furniture (armchair) | ANALOGOUS | LOW | Reference has exactly 1 furniture object (`02_Magis_Chair_One_4Star`) — a modern design chair, a different construction category from the photo's tufted armchair. Same general category (seating) only. |
| Wall system (framed art wall, apparel rack wall) | UNSUPPORTED | — | No wall, frame, or rack objects found anywhere in the 231-object categorization. |
| Flooring | UNSUPPORTED | — | No floor-specific object or material data recovered. |
| Storefront / entrance | UNSUPPORTED | — | Not visible in the photo (single interior camera angle) and no reference data either — ungrounded on both sides. |
| Door | UNSUPPORTED | — | Confirmed in an earlier pass: zero door objects exist in the reference with actual geometry, only unmatched comment-line mentions. |
| Windows / glazing | UNSUPPORTED | — | Same as door — mentioned only in comments, never matched to real geometry. |

## What this actually tells us

**Real coverage exists for**: lighting construction logic, small hardware
patterns, and — specifically — the checkout counter's computer/monitor.
Three genuinely useful, evidence-backed starting points.

**Zero coverage exists for**: the entire architectural envelope — walls,
floor, storefront, doors, windows. This is the highest-impact gap, because
these are the features that define the room's silhouette and are visible
in nearly every frame of the photo, not incidental details.

**Prioritized acquisition list** (highest visual-fidelity impact first,
based on gap size × visual prominence in the photo):

1. **Wall/display system** (framed art grid, apparel racking) — fully
   unsupported, and the single most visually dominant element in the photo
   after the room shell itself.
2. **Flooring** — fully unsupported, present in every frame.
3. **Storefront/entrance, door, windows** — fully unsupported, but lower
   immediate priority since none are visible in the current photo anyway;
   only matters once the boutique needs an exterior/entrance view.
4. Everything already TRANSFERABLE or ANALOGOUS (lighting, checkout,
   hardware, display furniture, seating) is lower priority — not because
   it's finished, but because partial reference coverage already exists to
   build from, unlike the fully-unsupported architectural shell.

Not proposing to acquire assets for all of these now — per the instruction,
this stops at the gap analysis. The next decision is which of the
UNSUPPORTED, high-priority rows to actually source reference material for.

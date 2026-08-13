// config/boutiqueShell.ts
//
// Frontend-side data for the 3D boutique environment (Milestone 6). Two
// kinds of data live here, kept deliberately separate:
//
// 1. `shellMeta` — imported directly from boutiqueShellMeta.json, which
//    `scripts/build_boutique_shell.py` emits alongside the .glb itself.
//    Room dimensions, the counter's real box, and every track-light head's
//    real world position all come from THAT file, not re-typed by hand
//    here — the geometry and the numbers used to light/place things around
//    it can't drift apart as long as both come from one script run.
//
// 2. `BOUTIQUE_HOTSPOTS_3D` — genuinely hand-placed, and said so. The 2D
//    hotspot photo (data/hotspots.ts) and this 3D shell are two different
//    projections of a first-pass, mostly-imagined room; there's no real
//    measurement linking a photo pixel to a 3D point. What IS reused,
//    honestly: each product's left-to-right ORDER, by mapping its photo-
//    space x% onto the room's real X width, so the two views feel like the
//    same store instead of an arbitrary shuffle. Depth and height are
//    plain first-pass placement (counter-top items vs. rack-height apparel)
//    — not measured, not final, flagged here rather than presented as
//    precise.

import shellMeta from "./boutiqueShellMeta.json";

export { shellMeta };

export const BOUTIQUE_SHELL_PATH = "/models/boutique_shell.glb";

/** Human eye height, standing just inside the open storefront edge,
 * looking back toward the counter — a sensible first look at the room,
 * not a measured "correct" viewpoint (there's no real camera to match). */
export const STARTING_CAMERA = {
  position: [0, 1.6, 2.3] as [number, number, number],
  target: [0, 1.2, -3.2] as [number, number, number],
};

export interface BoutiqueHotspot3D {
  /** Matches a Hotspot.id in data/hotspots.ts — clicking this marker opens
   * the exact same ProductModal the flat-photo experience uses. */
  hotspotId: string;
  position: [number, number, number];
}

// Deliberately NOT the full room half-width (roomBounds.x0..x1 = ±4.5m).
// A phone in portrait orientation has a narrow horizontal field of view
// (roughly half the vertical FOV, since horizontal FOV shrinks with
// aspect ratio) — mapping products across the full room width put several
// of them outside the starting camera's frame entirely, verified by
// screenshot during testing, not assumed. Compressing the map to a
// narrower central band keeps every marker within the starting view's
// frustum at the products' actual depth.
const HOTSPOT_X_BAND = 1.15;

interface RawPlacement {
  hotspotId: string;
  photoX: number;
  y: number;
  z: number;
}

// Raw photo-space x% (for ORDER only) plus first-pass height/depth —
// counter-top items lower and closer to the counter, apparel-row items
// slightly higher and further out. Not measured, not final; see file
// header.
const RAW_PLACEMENTS: RawPlacement[] = [
  { hotspotId: "pillow", photoX: 10.5, y: 1.15, z: -2.5 },
  { hotspotId: "mugColorful", photoX: 30.5, y: 1.15, z: -2.5 },
  { hotspotId: "whiteHoodie", photoX: 36, y: 1.5, z: -1.2 },
  { hotspotId: "mugWhite", photoX: 37, y: 1.15, z: -2.5 },
  { hotspotId: "foldedShirts", photoX: 39, y: 1.1, z: -1.2 },
  { hotspotId: "concertShirt", photoX: 47, y: 1.5, z: -1.2 },
  { hotspotId: "hoodieRight", photoX: 91, y: 1.5, z: -1.2 },
];

// Several of the photo's product x-positions sit within a few percent of
// each other (36/37/39) — mapping those raw values directly into the 3D
// band put their markers almost on top of each other, confirmed visually
// (overlapping/unreadable labels in a real screenshot during testing).
// Spacing by RANK instead of raw value keeps the same left-to-right ORDER
// — the thing worth carrying over from the photo — while guaranteeing
// even, readable separation regardless of how bunched the source percentages
// are.
const ordered = [...RAW_PLACEMENTS].sort((a, b) => a.photoX - b.photoX);
const step = ordered.length > 1 ? (2 * HOTSPOT_X_BAND) / (ordered.length - 1) : 0;

// Neighbors that share a row (same z/y — e.g. pillow and mugColorful both
// sit at z=-2.5, y=1.15, adjacent in rank too) still crowded each other
// even with even X spacing, confirmed by a real screenshot (overlapping
// labels). Tried a depth offset first — barely changed anything, because
// the starting camera looks nearly level, so a few tens of cm of Z barely
// moves a marker's projected screen Y at these distances (checked, not
// assumed: ~5px difference for a 0.35m offset). A vertical offset works
// directly on the axis that actually separates two horizontally-adjacent
// labels on screen.
const Y_JITTER = 0.16;

/** hand-placed first pass — see file header. */
export const BOUTIQUE_HOTSPOTS_3D: BoutiqueHotspot3D[] = ordered.map((p, i) => ({
  hotspotId: p.hotspotId,
  position: [
    -HOTSPOT_X_BAND + i * step,
    p.y + (i % 2 === 0 ? Y_JITTER : -Y_JITTER),
    p.z,
  ],
}));

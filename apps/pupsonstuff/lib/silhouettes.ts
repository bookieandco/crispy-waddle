// lib/silhouettes.ts
//
// GrabCut-based automatic silhouette extraction was tried first and
// discarded: the boutique photo's product/background colors are too close
// in tone in several spots, and it kept finding tiny or noisy blobs
// instead of clean product outlines. These are hand-fit shape templates
// instead — real silhouettes (a mug has its handle, a hoodie has
// shoulders and a neckline, a bottle tapers), positioned per hotspot by
// inspecting the actual boutique photo pixels, not a traced contour.
//
// Each template is a polygon in 0-100 space, LOCAL to whatever box it's
// applied to (0,0 = box top-left, 100,100 = box bottom-right) — usable
// directly as a CSS clip-path: polygon() or an SVG <polygon points>.

export type SilhouetteId =
  | "rect" // frames, folded stacks — genuinely rectangular objects
  | "pillow" // soft rounded square, cushion bulge
  | "bottle" // tapered cap, tall body
  | "mugHandle" // rounded body + handle bump on one side
  | "shirt" // shoulders, sleeves, neckline notch, tapered hem
  | "tote"; // trapezoid body, two handle-strap notches at the top

type Point = [number, number];

export const SILHOUETTES: Record<SilhouetteId, Point[]> = {
  rect: [
    [8, 0],
    [92, 0],
    [100, 8],
    [100, 92],
    [92, 100],
    [8, 100],
    [0, 92],
    [0, 8],
  ],
  pillow: [
    [20, 2],
    [80, 2],
    [96, 18],
    [100, 50],
    [96, 82],
    [80, 98],
    [20, 98],
    [4, 82],
    [0, 50],
    [4, 18],
  ],
  bottle: [
    [42, 0],
    [58, 0],
    [58, 6],
    [70, 14],
    [85, 22],
    [92, 30],
    [92, 85],
    [85, 93],
    [70, 98],
    [30, 98],
    [15, 93],
    [8, 85],
    [8, 30],
    [15, 22],
    [30, 14],
    [42, 6],
  ],
  mugHandle: [
    [15, 3],
    [65, 3],
    [75, 10],
    [75, 32],
    [96, 32],
    [96, 64],
    [75, 64],
    [75, 90],
    [65, 97],
    [15, 97],
    [5, 90],
    [5, 10],
  ],
  shirt: [
    [35, 0],
    [50, 6],
    [65, 0],
    [80, 0],
    [100, 15],
    [92, 32],
    [90, 100],
    [10, 100],
    [8, 32],
    [0, 15],
    [20, 0],
  ],
  tote: [
    [15, 20],
    [30, 20],
    [35, 5],
    [45, 5],
    [45, 20],
    [55, 20],
    [55, 5],
    [65, 5],
    [70, 20],
    [85, 20],
    [95, 100],
    [5, 100],
  ],
};

/** Renders a template as a CSS clip-path polygon() string. */
export function silhouetteClipPath(id: SilhouetteId): string {
  const points = SILHOUETTES[id]
    .map(([x, y]) => `${x}% ${y}%`)
    .join(", ");
  return `polygon(${points})`;
}

/** Renders a template as an SVG <polygon points="..."> string, 0-100 viewBox. */
export function silhouettePolygonPoints(id: SilhouetteId): string {
  return SILHOUETTES[id].map(([x, y]) => `${x},${y}`).join(" ");
}

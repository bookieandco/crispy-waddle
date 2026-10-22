/**
 * Deterministic, asset-unit-independent framing for the existing PupsonStuff
 * product viewer. This controls presentation ONLY, never print placement.
 *
 * The approved GLBs use very different raw units; a fixed camera distance
 * can make a correct product appear tiny or cropped. Bounding radius is
 * invariant under rotation, so portrait/landscape and modelRotation are safe.
 */
export type ModelSize = readonly [number, number, number];

export interface ProductCameraFrame {
  distance: number;
  minDistance: number;
  maxDistance: number;
}

export interface FrameOptions {
  fov?: number;
  aspect?: number;
  minDistance?: number;
  maxDistance?: number;
  padding?: number;
}

export function modelBoundingRadius(size: ModelSize, modelScale = 1): number | null {
  if (!size.every((value) => Number.isFinite(value) && value >= 0) ||
      !Number.isFinite(modelScale) || modelScale === 0) return null;
  const radius = Math.hypot(...size) * Math.abs(modelScale) / 2;
  return Number.isFinite(radius) && radius > 0 ? radius : null;
}

export function fitProductCamera(
  radius: number | null,
  options: FrameOptions = {},
): ProductCameraFrame | null {
  if (radius === null || !Number.isFinite(radius) || radius <= 0) return null;

  const safeFov = Math.min(80, Math.max(15,
    Number.isFinite(options.fov) ? options.fov! : 30));
  const safeAspect = Math.min(4, Math.max(0.25,
    Number.isFinite(options.aspect) ? options.aspect! : 1));
  const padding = Math.min(2, Math.max(1.05,
    Number.isFinite(options.padding) ? options.padding! : 1.14));
  const halfVertical = (safeFov * Math.PI) / 360;
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * safeAspect);
  // Sphere fitting is deliberately conservative when the owner rotates
  // the product, unlike a front-facing-only width/height heuristic.
  const distance = (radius / Math.sin(Math.min(halfVertical, halfHorizontal))) * padding;

  const configuredMin = Number.isFinite(options.minDistance) && (options.minDistance ?? 0) > 0
    ? options.minDistance!
    : distance * 0.65;
  const configuredMax = Number.isFinite(options.maxDistance) && (options.maxDistance ?? 0) > 0
    ? options.maxDistance!
    : distance * 1.85;

  return {
    distance,
    minDistance: Math.max(0.001, Math.min(configuredMin, distance * 0.65)),
    maxDistance: Math.max(configuredMax, distance * 1.85),
  };
}

/** Named, reproducible camera directions for storefront inspection and
 * actual front/side/back QA. These do NOT rotate product geometry, change
 * decal coordinates or claim a printable rear surface exists. */
export type ProductInspectionView = 'front' | 'side' | 'back';

export function inspectionCameraDirection(
  position: ModelSize,
  view: ProductInspectionView,
): [number, number, number] {
  const valid = position.every(Number.isFinite);
  const [x, y, z] = valid ? position : [0, 0, 1];
  const length = Math.hypot(x, y, z);
  const ox = length > 0 ? x / length : 0;
  const oy = length > 0 ? y / length : 0;
  const oz = length > 0 ? z / length : 1;
  const angle = view === 'back' ? Math.PI : view === 'side' ? Math.PI / 2 : 0;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  return [ox * cos + oz * sin, oy, -ox * sin + oz * cos];
}

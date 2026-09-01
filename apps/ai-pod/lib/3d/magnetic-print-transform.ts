export type MagneticTransform = {
  x: number;
  y: number;
  scale: number;
  rotationDeg: number;
};

export type PrintBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minScale: number;
  maxScale: number;
};

export type MagneticOptions = {
  snapStep?: number;
  snapDistance?: number;
  edgeMagnetDistance?: number;
  centerMagnetDistance?: number;
};

const DEFAULTS: Required<MagneticOptions> = {
  snapStep: 0.05,
  snapDistance: 0.035,
  edgeMagnetDistance: 0.04,
  centerMagnetDistance: 0.05,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const snapNear = (value: number, target: number, distance: number) =>
  Math.abs(value - target) <= distance ? target : value;

/**
 * The POD equivalent of the PupsonStuff resize/magnet/clip interaction:
 * resize stays inside the printable region, while position/scale gently
 * magnetize to useful anchors instead of requiring pixel-perfect dragging.
 * The renderer remains unaware of these editing rules.
 */
export function applyMagneticPrintTransform(
  transform: MagneticTransform,
  bounds: PrintBounds,
  options: MagneticOptions = {},
): MagneticTransform {
  const config = { ...DEFAULTS, ...options };

  const scale = clamp(transform.scale, bounds.minScale, bounds.maxScale);

  // Treat the artwork footprint as proportional to scale. This keeps the
  // artwork from being resized beyond the printable surface and provides a
  // deterministic normalized contract for every product type.
  const halfWidth = scale / 2;
  const halfHeight = scale / 2;

  let x = clamp(transform.x, bounds.minX + halfWidth, bounds.maxX - halfWidth);
  let y = clamp(transform.y, bounds.minY + halfHeight, bounds.maxY - halfHeight);

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  x = snapNear(x, centerX, config.centerMagnetDistance);
  y = snapNear(y, centerY, config.centerMagnetDistance);
  x = snapNear(x, bounds.minX + halfWidth, config.edgeMagnetDistance);
  x = snapNear(x, bounds.maxX - halfWidth, config.edgeMagnetDistance);
  y = snapNear(y, bounds.minY + halfHeight, config.edgeMagnetDistance);
  y = snapNear(y, bounds.maxY - halfHeight, config.edgeMagnetDistance);

  // Fine snapping makes slider/drag updates stable without making the
  // interaction feel locked to a visible grid.
  x = Math.round(x / config.snapStep) * config.snapStep;
  y = Math.round(y / config.snapStep) * config.snapStep;

  return {
    x: clamp(x, bounds.minX + halfWidth, bounds.maxX - halfWidth),
    y: clamp(y, bounds.minY + halfHeight, bounds.maxY - halfHeight),
    scale,
    rotationDeg: transform.rotationDeg,
  };
}

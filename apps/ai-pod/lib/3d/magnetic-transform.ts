export type PrintBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type ArtworkTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export type MagneticTransformOptions = {
  snapDistance?: number;
  edgeInset?: number;
  minScale?: number;
  maxScale?: number;
};

const DEFAULTS: Required<MagneticTransformOptions> = {
  snapDistance: 0.04,
  edgeInset: 0.02,
  minScale: 0.1,
  maxScale: 1,
};

/**
 * Keeps the editor transform inside the printable surface and applies subtle
 * center/edge magnetic snapping. Coordinates are normalized to the surface.
 */
export function constrainArtworkTransform(
  transform: ArtworkTransform,
  bounds: PrintBounds,
  options: MagneticTransformOptions = {},
): ArtworkTransform {
  const config = { ...DEFAULTS, ...options };
  const scale = clamp(transform.scale, config.minScale, config.maxScale);

  const x = snapAndClamp(
    transform.x,
    [bounds.minX + config.edgeInset, bounds.maxX - config.edgeInset],
    [0, bounds.minX + config.edgeInset, bounds.maxX - config.edgeInset],
    config.snapDistance,
  );
  const y = snapAndClamp(
    transform.y,
    [bounds.minY + config.edgeInset, bounds.maxY - config.edgeInset],
    [0, bounds.minY + config.edgeInset, bounds.maxY - config.edgeInset],
    config.snapDistance,
  );

  return { ...transform, x, y, scale };
}

function snapAndClamp(
  value: number,
  range: [number, number],
  targets: number[],
  distance: number,
): number {
  const target = targets.find((candidate) => Math.abs(value - candidate) <= distance);
  return clamp(target ?? value, range[0], range[1]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

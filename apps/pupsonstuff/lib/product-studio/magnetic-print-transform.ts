export interface ArtworkTransform {
  x: number;
  y: number;
  scale: number;
  rotationDeg: number;
}

export interface PrintBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minScale: number;
  maxScale: number;
}

export interface MagneticOptions {
  snapStep?: number;
  edgeMagnetDistance?: number;
  centerMagnetDistance?: number;
}

const DEFAULTS: Required<MagneticOptions> = {
  snapStep: 0.025,
  edgeMagnetDistance: 0.04,
  centerMagnetDistance: 0.05,
};

const DEFAULT_BOUNDS: PrintBounds = {
  minX: 0,
  maxX: 1,
  minY: 0,
  maxY: 1,
  minScale: 0.25,
  maxScale: 1,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const finite = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const snapNear = (value: number, target: number, distance: number) =>
  Math.abs(value - target) <= distance ? target : value;

export const DEFAULT_ARTWORK_TRANSFORM: ArtworkTransform = {
  x: 0.5,
  y: 0.5,
  scale: 0.72,
  rotationDeg: 0,
};

export function normalizeArtworkTransform(
  value: Partial<ArtworkTransform> | null | undefined,
  bounds: PrintBounds = DEFAULT_BOUNDS,
  options: MagneticOptions = {}
): ArtworkTransform {
  const config = { ...DEFAULTS, ...options };
  const scale = clamp(
    finite(value?.scale, DEFAULT_ARTWORK_TRANSFORM.scale),
    bounds.minScale,
    bounds.maxScale
  );

  let x = clamp(finite(value?.x, DEFAULT_ARTWORK_TRANSFORM.x), bounds.minX, bounds.maxX);
  let y = clamp(finite(value?.y, DEFAULT_ARTWORK_TRANSFORM.y), bounds.minY, bounds.maxY);

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  x = snapNear(x, centerX, config.centerMagnetDistance);
  y = snapNear(y, centerY, config.centerMagnetDistance);
  x = snapNear(x, bounds.minX, config.edgeMagnetDistance);
  x = snapNear(x, bounds.maxX, config.edgeMagnetDistance);
  y = snapNear(y, bounds.minY, config.edgeMagnetDistance);
  y = snapNear(y, bounds.maxY, config.edgeMagnetDistance);

  x = Math.round(x / config.snapStep) * config.snapStep;
  y = Math.round(y / config.snapStep) * config.snapStep;

  let rotationDeg = finite(value?.rotationDeg, 0) % 360;
  if (rotationDeg > 180) rotationDeg -= 360;
  if (rotationDeg < -180) rotationDeg += 360;

  return {
    x: clamp(x, bounds.minX, bounds.maxX),
    y: clamp(y, bounds.minY, bounds.maxY),
    scale,
    rotationDeg,
  };
}

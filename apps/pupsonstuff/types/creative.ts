export type BackgroundMode = 'auto' | 'transparent' | 'keep' | 'generate';

export interface ArtworkTransform {
  /** normalized print-area center, 0..1 */
  x: number;
  /** normalized print-area center, 0..1 */
  y: number;
  /** relative scale, 1 = default safe-area fit */
  scale: number;
  /** clockwise degrees */
  rotation: number;
}

export const DEFAULT_ARTWORK_TRANSFORM: ArtworkTransform = {
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
};

export function normalizeArtworkTransform(input: Partial<ArtworkTransform> | null | undefined): ArtworkTransform {
  const finite = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return {
    x: Math.min(1, Math.max(0, finite(input?.x, 0.5))),
    y: Math.min(1, Math.max(0, finite(input?.y, 0.5))),
    scale: Math.min(2, Math.max(0.2, finite(input?.scale, 1))),
    rotation: Math.min(180, Math.max(-180, finite(input?.rotation, 0))),
  };
}

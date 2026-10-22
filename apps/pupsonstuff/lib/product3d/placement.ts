import { normalizeArtworkTransform, type ArtworkTransform } from '../../types/creative';

export function placementBounds(input: Partial<ArtworkTransform>, imageAspect = 1, areaAspect = 1) {
  const transform = normalizeArtworkTransform(input);
  const angle = (transform.rotation * Math.PI) / 180;
  const ratio = Number.isFinite(imageAspect) && imageAspect > 0 ? imageAspect : 1;
  const area = Number.isFinite(areaAspect) && areaAspect > 0 ? areaAspect : 1;
  const rotatedWidth = Math.abs(Math.cos(angle)) * ratio + Math.abs(Math.sin(angle));
  const rotatedHeight = Math.abs(Math.sin(angle)) * ratio + Math.abs(Math.cos(angle));
  const fit = Math.min(area / rotatedWidth, 1 / rotatedHeight) * 0.5 * transform.scale;
  return {
    transform,
    width: (ratio * fit) / area,
    height: fit,
    minX: (rotatedWidth * fit) / area / 2,
    maxX: 1 - (rotatedWidth * fit) / area / 2,
    minY: (rotatedHeight * fit) / 2,
    maxY: 1 - (rotatedHeight * fit) / 2,
  };
}

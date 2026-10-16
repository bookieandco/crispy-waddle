/** One image-space coordinate system shared by the photograph and hotspots. */
export const BOUTIQUE_IMAGE_WIDTH = 1568;
export const BOUTIQUE_IMAGE_HEIGHT = 1003;
export const BOUTIQUE_ASPECT_RATIO = BOUTIQUE_IMAGE_WIDTH / BOUTIQUE_IMAGE_HEIGHT;

/** Scroll to an image-space percentage; clamp at the visible room edges. */
export function boutiquePanLeft(stageWidth: number, viewportWidth: number, xPercent: number): number {
  if (![stageWidth, viewportWidth, xPercent].every(Number.isFinite) ||
      stageWidth <= 0 || viewportWidth <= 0) return 0;
  const maxLeft = Math.max(0, stageWidth - viewportWidth);
  const x = Math.max(0, Math.min(100, xPercent));
  return Math.min(maxLeft, Math.max(0, stageWidth * x / 100 - viewportWidth / 2));
}

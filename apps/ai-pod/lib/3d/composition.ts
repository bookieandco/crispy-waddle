import type { PodProductDefinition, PrintSurface } from "@jhadina/pod-product-core";

export type ArtworkPlacement = {
  assetUrl: string;
  surfaceId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export type ProductComposition = {
  productId: string;
  placements: ArtworkPlacement[];
};

export function composeArtwork(
  product: PodProductDefinition,
  assetUrl: string,
  surfaceId?: string,
): ProductComposition {
  const surface = selectSurface(product.printableSurfaces, surfaceId);

  return {
    productId: product.id,
    placements: [
      {
        assetUrl,
        surfaceId: surface.id,
        x: surface.defaultTransform.x,
        y: surface.defaultTransform.y,
        scale: surface.defaultTransform.scale,
        rotation: surface.defaultTransform.rotation,
      },
    ],
  };
}

function selectSurface(surfaces: PrintSurface[], surfaceId?: string): PrintSurface {
  if (surfaces.length === 0) {
    throw new Error("Product has no printable surfaces");
  }

  if (!surfaceId) return surfaces[0];

  const surface = surfaces.find((candidate) => candidate.id === surfaceId);
  if (!surface) throw new Error(`Unknown printable surface: ${surfaceId}`);
  return surface;
}

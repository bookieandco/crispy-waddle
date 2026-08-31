import type { PodProductDefinition } from "@jhadina/pod-product-core";
import type { ProductComposition } from "./composition";

export type ViewerRenderModel = {
  modelUrl: string;
  variantId?: string;
  cameraPreset?: string;
  artwork: Array<{
    assetUrl: string;
    surfaceId: string;
    transform: { x: number; y: number; scale: number; rotation: number };
  }>;
};

/**
 * Converts product + composition state into renderer input.
 * A Three.js/R3F component can consume this without knowing POD or AI APIs.
 */
export function toViewerRenderModel(
  product: PodProductDefinition,
  composition: ProductComposition,
  options: { variantId?: string; cameraPreset?: string } = {},
): ViewerRenderModel {
  if (product.model.kind !== "gltf") {
    throw new Error(`Unsupported product model kind: ${product.model.kind}`);
  }

  return {
    modelUrl: product.model.url,
    variantId: options.variantId,
    cameraPreset: options.cameraPreset,
    artwork: composition.placements.map((placement) => ({
      assetUrl: placement.assetUrl,
      surfaceId: placement.surfaceId,
      transform: {
        x: placement.x,
        y: placement.y,
        scale: placement.scale,
        rotation: placement.rotation,
      },
    })),
  };
}

import type { PodProductDefinition } from "@jhadina/pod-product-core";
import { composeArtwork, type ProductComposition } from "./composition";
import { toViewerRenderModel, type ViewerRenderModel } from "./viewer-adapter";

export type CreativeAsset = {
  id: string;
  url: string;
  width?: number;
  height?: number;
};

export type ProductStudioInput = {
  asset: CreativeAsset;
  product: PodProductDefinition;
  surfaceId?: string;
  variantId?: string;
  cameraPreset?: string;
};

export type ProductStudioSession = {
  asset: CreativeAsset;
  composition: ProductComposition;
  renderModel: ViewerRenderModel;
};

/** Turns a completed shared creative asset into the initial product-studio state. */
export function createProductStudioSession(
  input: ProductStudioInput,
): ProductStudioSession {
  const composition = composeArtwork(
    input.product,
    input.asset.url,
    input.surfaceId,
  );

  const renderModel = toViewerRenderModel(input.product, composition, {
    variantId: input.variantId,
    cameraPreset: input.cameraPreset,
  });

  return {
    asset: input.asset,
    composition,
    renderModel,
  };
}

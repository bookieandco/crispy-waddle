import type { CreativeArtProvider, CreativeArtRequest } from "@jhadina/director-core";
import type { PodProductDefinition } from "@jhadina/pod-product-core";
import {
  createProductStudioSession,
  type ProductStudioSession,
} from "../3d/creative-asset-bridge";

export type CompletedCreativeAssetResolver = {
  getAsset: (generationId: string) => Promise<{
    id: string;
    url: string;
    width?: number;
    height?: number;
  } | null>;
};

export type CreateAndOpenStudioInput = {
  request: CreativeArtRequest;
  product: PodProductDefinition;
  surfaceId?: string;
  variantId?: string;
  cameraPreset?: string;
};

export type CreateAndOpenStudioResult = {
  generationId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  studio?: ProductStudioSession;
};

/**
 * Application workflow: submit shared AI artwork, then hydrate the product
 * studio only after the generated asset is available.
 */
export async function createAndOpenStudio(
  provider: CreativeArtProvider,
  assets: CompletedCreativeAssetResolver,
  input: CreateAndOpenStudioInput,
): Promise<CreateAndOpenStudioResult> {
  const generation = await provider.generate(input.request);

  if (generation.status !== "completed") {
    return {
      generationId: generation.generationId,
      status: generation.status,
    };
  }

  const asset = await assets.getAsset(generation.generationId);
  if (!asset) {
    throw new Error("Generation completed but no creative asset was found");
  }

  return {
    generationId: generation.generationId,
    status: "completed",
    studio: createProductStudioSession({
      asset,
      product: input.product,
      surfaceId: input.surfaceId,
      variantId: input.variantId,
      cameraPreset: input.cameraPreset,
    }),
  };
}

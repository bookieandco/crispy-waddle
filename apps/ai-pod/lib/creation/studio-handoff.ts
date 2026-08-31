import type { ProductStudioSession } from "../3d/creative-asset-bridge";

export type CreationViewState =
  | { view: "create" }
  | { view: "generating"; generationId: string }
  | { view: "studio"; session: ProductStudioSession }
  | { view: "error"; message: string };

export function openStudio(session: ProductStudioSession): CreationViewState {
  return { view: "studio", session };
}

export function showGeneration(generationId: string): CreationViewState {
  return { view: "generating", generationId };
}

export function showCreation(): CreationViewState {
  return { view: "create" };
}

export function showCreationError(message: string): CreationViewState {
  return { view: "error", message };
}

import type { ProductComposition } from "./composition";
import type { PodProductDefinition } from "@jhadina/pod-product-core";

export type ViewerState = {
  composition: ProductComposition;
  variantId?: string;
  cameraPreset?: string;
  autoRotate: boolean;
};

export type ViewerCommand =
  | { type: "set-variant"; variantId: string }
  | { type: "select-surface"; surfaceId: string }
  | { type: "move-artwork"; x: number; y: number }
  | { type: "scale-artwork"; scale: number }
  | { type: "rotate-artwork"; rotation: number }
  | { type: "set-camera"; preset: string }
  | { type: "set-auto-rotate"; enabled: boolean };

export function createViewerState(
  product: PodProductDefinition,
  composition: ProductComposition,
): ViewerState {
  return {
    composition,
    variantId: product.variants[0]?.id,
    cameraPreset: product.cameraPresets[0]?.id,
    autoRotate: true,
  };
}

export function applyViewerCommand(
  state: ViewerState,
  command: ViewerCommand,
): ViewerState {
  switch (command.type) {
    case "set-variant":
      return { ...state, variantId: command.variantId };
    case "select-surface":
      return {
        ...state,
        composition: {
          ...state.composition,
          placements: state.composition.placements.map((placement) => ({
            ...placement,
            surfaceId: command.surfaceId,
          })),
        },
      };
    case "move-artwork":
      return {
        ...state,
        composition: {
          ...state.composition,
          placements: state.composition.placements.map((placement) => ({
            ...placement,
            x: command.x,
            y: command.y,
          })),
        },
      };
    case "scale-artwork":
      return {
        ...state,
        composition: {
          ...state.composition,
          placements: state.composition.placements.map((placement) => ({
            ...placement,
            scale: command.scale,
          })),
        },
      };
    case "rotate-artwork":
      return {
        ...state,
        composition: {
          ...state.composition,
          placements: state.composition.placements.map((placement) => ({
            ...placement,
            rotation: command.rotation,
          })),
        },
      };
    case "set-camera":
      return { ...state, cameraPreset: command.preset };
    case "set-auto-rotate":
      return { ...state, autoRotate: command.enabled };
  }
}

export type InteractionMode = "inspect" | "orbit" | "focus";

export interface ProductInteractionProfile {
  id: string;
  focusDistance: number;
  focusHeight: number;
  hoverScale: number;
  enableTilt: boolean;
  enableGlow: boolean;
}

/**
 * Lightweight engine-style interaction contract for PupsonStuff.
 *
 * Inspired by game-engine scene/action patterns without shipping a second
 * rendering engine into the Next.js bundle. Three.js remains the renderer;
 * this module owns deterministic interaction behavior and keeps it reusable
 * for a future AR/Godot experience.
 */
export const DEFAULT_INTERACTION: Omit<ProductInteractionProfile, "id"> = {
  focusDistance: 1.35,
  focusHeight: 1.05,
  hoverScale: 1.035,
  enableTilt: true,
  enableGlow: true,
};

export function createProductInteractionProfile(
  id: string,
  overrides: Partial<Omit<ProductInteractionProfile, "id">> = {}
): ProductInteractionProfile {
  return { id, ...DEFAULT_INTERACTION, ...overrides };
}

export function getInteractionLabel(mode: InteractionMode): string {
  switch (mode) {
    case "focus":
      return "Inspecting product";
    case "orbit":
      return "Explore the boutique";
    default:
      return "Tap a product to inspect it";
  }
}

export function clampInteraction(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export type ShotEnergy = "low" | "medium" | "high";
export type ShotRecipeCategory = "establishing" | "dialogue" | "performance" | "action" | "transition" | "product" | "documentary";

export interface ShotRecipe {
  id: string;
  label: string;
  category: ShotRecipeCategory;
  description: string;
  defaultDurationSec: number;
  energy: ShotEnergy;
  directorDefaults?: {
    lens?: string;
    framing?: string;
    cameraMovement?: string;
  };
  tags: string[];
}

export const shotRecipes: Record<string, ShotRecipe> = {
  "slow-push-in": {
    id: "slow-push-in",
    label: "Slow Push-In",
    category: "performance",
    description: "Gradually move the camera toward the subject to increase intimacy or tension.",
    defaultDurationSec: 5,
    energy: "medium",
    directorDefaults: { lens: "50mm", framing: "medium close-up", cameraMovement: "slow dolly in" },
    tags: ["intimacy", "tension", "dialogue"],
  },
  "wide-establishing": {
    id: "wide-establishing",
    label: "Wide Establishing",
    category: "establishing",
    description: "Introduce location, geography, and subject context with a stable wide frame.",
    defaultDurationSec: 4,
    energy: "low",
    directorDefaults: { lens: "24mm", framing: "wide", cameraMovement: "locked-off" },
    tags: ["location", "geography", "opening"],
  },
  "hero-product-orbit": {
    id: "hero-product-orbit",
    label: "Hero Product Orbit",
    category: "product",
    description: "Controlled orbit around a product or subject for a premium reveal.",
    defaultDurationSec: 6,
    energy: "medium",
    directorDefaults: { lens: "50mm", framing: "hero", cameraMovement: "slow orbital" },
    tags: ["product", "hero", "reveal"],
  },
};

export function getShotRecipe(id: string): ShotRecipe | undefined {
  return shotRecipes[id];
}

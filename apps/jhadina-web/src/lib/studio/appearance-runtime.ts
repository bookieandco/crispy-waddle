export type AppearanceProvider = "fashiongan" | "catvton" | "deepfashion2" | "native-3d";

export interface GarmentSpec {
  garmentId: string;
  category: string;
  material?: string;
  color?: string;
  pattern?: string;
  referenceAssetId?: string;
  physicsProfile?: string;
}

export interface HairSpec {
  styleId: string;
  strandMode: "cards" | "curves" | "simulated";
  length: number;
  density: number;
  physicsProfile?: string;
}

export interface DetailSpec {
  makeup?: Record<string, unknown>;
  accessories?: string[];
  skinDetails?: Record<string, unknown>;
  fabricDetails?: Record<string, unknown>;
  footwear?: string;
}

export interface AppearancePlan {
  characterId: string;
  provider: AppearanceProvider;
  garments: GarmentSpec[];
  hair?: HairSpec;
  details: DetailSpec;
  preserveIdentity: boolean;
  preserveContinuity: boolean;
}

export function createAppearancePlan(input: Omit<AppearancePlan, "preserveIdentity" | "preserveContinuity">): AppearancePlan {
  return { ...input, preserveIdentity: true, preserveContinuity: true };
}

import type { JhadinaBrand, SocialPlatform } from "./types.js";

export interface BrandSocialConfig {
  id: JhadinaBrand;
  label: string;
  defaultPlatforms: SocialPlatform[];
}

const DEFAULT_SOCIAL: SocialPlatform[] = ["facebook", "instagram", "tiktok", "youtube"];

export const BRAND_SOCIAL_CONFIG: Record<JhadinaBrand, BrandSocialConfig> = {
  overageos: { id: "overageos", label: "OverageOS", defaultPlatforms: DEFAULT_SOCIAL },
  jhadinatv: { id: "jhadinatv", label: "JhadinaTV", defaultPlatforms: DEFAULT_SOCIAL },
  "jhadina-music": { id: "jhadina-music", label: "Jhadina Music", defaultPlatforms: DEFAULT_SOCIAL },
  bookieandco: { id: "bookieandco", label: "Bookie & Co.", defaultPlatforms: DEFAULT_SOCIAL },
  jhadina: { id: "jhadina", label: "Jhadina", defaultPlatforms: DEFAULT_SOCIAL },
  pupsonstuff: { id: "pupsonstuff", label: "PupsonStuff", defaultPlatforms: DEFAULT_SOCIAL },
  "atwood-bookie": { id: "atwood-bookie", label: "Atwood Bookie", defaultPlatforms: DEFAULT_SOCIAL },
};

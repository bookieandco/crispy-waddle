import type { JhadinaBrand, SocialPlatform } from "./types";

export interface BrandSocialConfig {
  id: JhadinaBrand;
  label: string;
  defaultPlatforms: SocialPlatform[];
}

export const BRAND_SOCIAL_CONFIG: Record<JhadinaBrand, BrandSocialConfig> = {
  overageos: { id: "overageos", label: "OverageOS", defaultPlatforms: ["facebook", "instagram", "tiktok", "youtube"] },
  jhadinatv: { id: "jhadinatv", label: "JhadinaTV", defaultPlatforms: ["facebook", "instagram", "tiktok", "youtube"] },
  "jhadina-music": { id: "jhadina-music", label: "Jhadina Music", defaultPlatforms: ["facebook", "instagram", "tiktok", "youtube"] },
  bookieandco: { id: "bookieandco", label: "Bookie & Co.", defaultPlatforms: ["facebook", "instagram", "tiktok", "youtube"] },
};

import type {
  JhadinaBrand,
  KnownJhadinaBrand,
  SocialPlatform,
  VentureSocialBrand,
} from "./types.js";

export interface BrandSocialConfig {
  id: JhadinaBrand;
  label: string;
  defaultPlatforms: SocialPlatform[];
}

const DEFAULT_SOCIAL: SocialPlatform[] = ["facebook", "instagram", "tiktok", "youtube"];

export const BRAND_SOCIAL_CONFIG: Record<KnownJhadinaBrand, BrandSocialConfig> = {
  overageos: { id: "overageos", label: "OverageOS", defaultPlatforms: DEFAULT_SOCIAL },
  jhadinatv: { id: "jhadinatv", label: "JhadinaTV", defaultPlatforms: DEFAULT_SOCIAL },
  "jhadina-music": { id: "jhadina-music", label: "Jhadina Music", defaultPlatforms: DEFAULT_SOCIAL },
  bookieandco: { id: "bookieandco", label: "Bookie & Co.", defaultPlatforms: DEFAULT_SOCIAL },
  jhadina: { id: "jhadina", label: "Jhadina", defaultPlatforms: DEFAULT_SOCIAL },
  pupsonstuff: { id: "pupsonstuff", label: "PupsonStuff", defaultPlatforms: DEFAULT_SOCIAL },
  "atwood-bookie": { id: "atwood-bookie", label: "Atwood Bookie", defaultPlatforms: DEFAULT_SOCIAL },
  truckeros: { id: "truckeros", label: "Truckeros", defaultPlatforms: DEFAULT_SOCIAL },
};


export function ventureSocialBrand(ventureRef: string): VentureSocialBrand {
  const clean = ventureRef.trim();
  if (!clean) throw new Error("SOCIAL_VENTURE_BRAND_REF_REQUIRED");
  const slug = clean
    .replace(/^venture:/i, "")
    .replace(/[^0-9A-Za-z:_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("SOCIAL_VENTURE_BRAND_REF_INVALID");
  return `venture:${slug}`;
}

export function isVentureSocialBrand(value: string): value is VentureSocialBrand {
  return /^venture:[0-9A-Za-z][0-9A-Za-z:_-]*$/.test(value.trim());
}

export function getBrandSocialConfig(brand: JhadinaBrand): BrandSocialConfig {
  if (isVentureSocialBrand(brand)) {
    const label = brand.slice("venture:".length)
      .replace(/[-_:]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    return {
      id: brand,
      label: label || brand,
      defaultPlatforms: [...DEFAULT_SOCIAL],
    };
  }
  const config = BRAND_SOCIAL_CONFIG[brand];
  return {
    ...config,
    defaultPlatforms: [...config.defaultPlatforms],
  };
}

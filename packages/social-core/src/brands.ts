import type { JhadinaBrand, KnownJhadinaBrand, SocialPlatform, VentureSocialBrand } from "./types.js";

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

/** Strict, collision-resistant venture brand keys; no silent slug normalization. */
export function ventureSocialBrand(ventureRef: string): VentureSocialBrand {
  const id=ventureRef.trim().replace(/^venture:/i, "");
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id))
    throw new Error("SOCIAL_VENTURE_BRAND_REF_INVALID");
  return ("venture:" + id) as VentureSocialBrand;
}
export function isVentureSocialBrand(value: string): value is VentureSocialBrand {
  return /^venture:[a-z0-9][a-z0-9_-]{0,63}$/.test(value);
}
export function getBrandSocialConfig(brand: JhadinaBrand): BrandSocialConfig {
  if (isVentureSocialBrand(brand))
    return {id:brand,label:brand.slice(8).replace(/[-_]/g," "),defaultPlatforms:[...DEFAULT_SOCIAL]};
  const existing=BRAND_SOCIAL_CONFIG[brand as KnownJhadinaBrand];
  if (!existing) throw new Error("SOCIAL_BRAND_NOT_REGISTERED");
  return {...existing,defaultPlatforms:[...existing.defaultPlatforms]};
}

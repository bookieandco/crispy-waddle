import { describe, expect, it } from "vitest";
import {
  BRAND_SOCIAL_CONFIG,
  getBrandSocialConfig,
  isVentureSocialBrand,
  ventureSocialBrand,
} from "./brands.js";

describe("Social brand registry", () => {
  it("preserves canonical named brand configuration", () => {
    expect(BRAND_SOCIAL_CONFIG.pupsonstuff.label).toBe("PupsonStuff");
    expect(getBrandSocialConfig("pupsonstuff").defaultPlatforms).toContain("instagram");
  });

  it("creates a governed venture namespace for Business Factory social properties", () => {
    const brand = ventureSocialBrand("venture:buyer-guides-01");
    expect(brand).toBe("venture:buyer-guides-01");
    expect(isVentureSocialBrand(brand)).toBe(true);

    const config = getBrandSocialConfig(brand);
    expect(config.id).toBe(brand);
    expect(config.label).toBe("Buyer Guides 01");
    expect(config.defaultPlatforms).toContain("youtube");
  });

  it("fails closed for empty venture identity", () => {
    expect(() => ventureSocialBrand(" ")).toThrow(/REF_REQUIRED/);
  });
});

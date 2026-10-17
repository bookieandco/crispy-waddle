import { describe, expect, it } from "vitest";
import type {
  JhadinaBrand,
  SocialPublishTarget,
} from "@jhadina/social-core";
import {
  commercialSocialBrand,
  resolveFacelessYouTubeVentureAccount,
  resolvePupsonStuffInstagramAccount,
} from "./commercial-account-binding";

function repository(target: SocialPublishTarget) {
  return {
    async resolveTargets(
      _userId: string,
      brand: JhadinaBrand,
      accountIds: readonly string[],
    ): Promise<SocialPublishTarget[]> {
      if (brand !== target.brand) {
        throw new Error("SOCIAL_TARGET_OWNERSHIP_OR_BRAND_MISMATCH");
      }
      if (!accountIds.includes(target.accountId)) {
        throw new Error("SOCIAL_TARGET_OWNERSHIP_OR_BRAND_MISMATCH");
      }
      return [target];
    },
  };
}

describe("commercial Social account binding", () => {
  it("resolves PupsonStuff Instagram only through the canonical PupsonStuff brand", async () => {
    const binding = await resolvePupsonStuffInstagramAccount({
      repository: repository({
        accountId: "acct:pup:ig",
        brand: "pupsonstuff",
        provider: "hootsuite",
        providerProfileId: "ig:pupsonstuff",
        platform: "instagram",
      }),
      userId: "user-1",
      accountId: "acct:pup:ig",
      evidenceRefs: ["brand:pupsonstuff", "commerce:pupsonstuff"],
    });

    expect(binding.socialBrand).toBe("pupsonstuff");
    expect(binding.platform).toBe("instagram");
    expect(binding.publicationAuthority).toBe("NONE");
  });

  it("gives a faceless Business Factory channel its own venture social brand", async () => {
    const expectedBrand = "venture:owned-media-buyer-guides" as const;
    const binding = await resolveFacelessYouTubeVentureAccount({
      repository: repository({
        accountId: "acct:youtube:buyer-guides",
        brand: expectedBrand,
        provider: "hootsuite",
        providerProfileId: "youtube:buyer-guides",
        platform: "youtube",
      }),
      userId: "user-1",
      growthBrandId: "brand:buyer-guides",
      ventureRef: "venture:owned-media-buyer-guides",
      accountId: "acct:youtube:buyer-guides",
      evidenceRefs: ["owned-media:buyer-guides", "affiliate:program"],
    });

    expect(binding.socialBrand).toBe(expectedBrand);
    expect(binding.platform).toBe("youtube");
  });

  it("fails when PupsonStuff content is pointed at another brand's Instagram account", async () => {
    await expect(resolvePupsonStuffInstagramAccount({
      repository: repository({
        accountId: "acct:bookie:ig",
        brand: "atwood-bookie",
        provider: "hootsuite",
        providerProfileId: "ig:bookie",
        platform: "instagram",
      }),
      userId: "user-1",
      accountId: "acct:bookie:ig",
      evidenceRefs: ["brand:pupsonstuff"],
    })).rejects.toThrow(/OWNERSHIP_OR_BRAND_MISMATCH/);
  });

  it("fails when a faceless YouTube venture account resolves to the wrong platform", async () => {
    await expect(resolveFacelessYouTubeVentureAccount({
      repository: repository({
        accountId: "acct:venture:tiktok",
        brand: "venture:owned-media-buyer-guides",
        provider: "hootsuite",
        providerProfileId: "tiktok:buyer-guides",
        platform: "tiktok",
      }),
      userId: "user-1",
      growthBrandId: "brand:buyer-guides",
      ventureRef: "venture:owned-media-buyer-guides",
      accountId: "acct:venture:tiktok",
      evidenceRefs: ["owned-media:buyer-guides"],
    })).rejects.toThrow(/PLATFORM_MISMATCH/);
  });

  it("requires a venture reference for unknown Growth brands", () => {
    expect(() => commercialSocialBrand({
      growthBrandId: "brand:new-faceless-channel",
    })).toThrow(/VENTURE_REF_REQUIRED/);
  });
});

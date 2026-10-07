import {
  ventureSocialBrand,
  type JhadinaBrand,
  type SocialPlatform,
  type SocialPublishTarget,
} from "@jhadina/social-core";
import type { GrowthId } from "@jhadina/growth-core";
import type { SocialRepository } from "./repository";

const GROWTH_TO_SOCIAL_BRAND: Readonly<Record<string, JhadinaBrand>> = {
  "brand:pupsonstuff": "pupsonstuff",
  "brand:atwood-bookie": "atwood-bookie",
  "brand:truckeros": "truckeros",
  "brand:jhadina": "jhadina",
  "brand:jhadinatv": "jhadinatv",
  "brand:bookieandco": "bookieandco",
  "brand:overageos": "overageos",
  "brand:jhadina-music": "jhadina-music",
};

export interface CommercialSocialAccountBinding {
  growthBrandId: GrowthId;
  socialBrand: JhadinaBrand;
  accountId: string;
  platform: SocialPlatform;
  provider: string;
  providerProfileId: string;
  evidenceRefs: readonly string[];
  authority: "ACCOUNT_BINDING_ONLY";
  publicationAuthority: "NONE";
}

export function commercialSocialBrand(input: {
  growthBrandId: GrowthId;
  ventureRef?: string;
}): JhadinaBrand {
  const known = GROWTH_TO_SOCIAL_BRAND[input.growthBrandId];
  if (known) return known;
  if (!input.ventureRef?.trim()) {
    throw new Error("SOCIAL_COMMERCIAL_VENTURE_REF_REQUIRED");
  }
  return ventureSocialBrand(input.ventureRef);
}

export async function resolveCommercialSocialAccount(input: {
  repository: Pick<SocialRepository, "resolveTargets">;
  userId: string;
  growthBrandId: GrowthId;
  ventureRef?: string;
  accountId: string;
  platform: SocialPlatform;
  evidenceRefs: readonly string[];
}): Promise<CommercialSocialAccountBinding> {
  if (!input.userId.trim()) {
    throw new Error("SOCIAL_COMMERCIAL_USER_REQUIRED");
  }
  if (!input.accountId.trim()) {
    throw new Error("SOCIAL_COMMERCIAL_ACCOUNT_REQUIRED");
  }
  if (!input.evidenceRefs.length) {
    throw new Error("SOCIAL_COMMERCIAL_ACCOUNT_EVIDENCE_REQUIRED");
  }

  const socialBrand = commercialSocialBrand({
    growthBrandId: input.growthBrandId,
    ventureRef: input.ventureRef,
  });

  const targets = await input.repository.resolveTargets(
    input.userId,
    socialBrand,
    [input.accountId],
  );
  if (targets.length !== 1) {
    throw new Error("SOCIAL_COMMERCIAL_ACCOUNT_RESOLUTION_AMBIGUOUS");
  }
  const target = targets[0]!;
  if (target.accountId !== input.accountId) {
    throw new Error("SOCIAL_COMMERCIAL_ACCOUNT_ID_MISMATCH");
  }
  if (target.brand !== socialBrand) {
    throw new Error("SOCIAL_COMMERCIAL_ACCOUNT_BRAND_MISMATCH");
  }
  if (target.platform !== input.platform) {
    throw new Error("SOCIAL_COMMERCIAL_ACCOUNT_PLATFORM_MISMATCH");
  }

  return Object.freeze({
    growthBrandId: input.growthBrandId,
    socialBrand,
    accountId: target.accountId,
    platform: target.platform,
    provider: target.provider,
    providerProfileId: target.providerProfileId,
    evidenceRefs: Object.freeze(unique([
      ...input.evidenceRefs,
      `social-account:${target.accountId}`,
      `social-brand:${target.brand}`,
      `social-platform:${target.platform}`,
      `social-provider:${target.provider}`,
      `social-provider-profile:${target.providerProfileId}`,
    ])),
    authority: "ACCOUNT_BINDING_ONLY" as const,
    publicationAuthority: "NONE" as const,
  });
}

export async function resolvePupsonStuffInstagramAccount(input: {
  repository: Pick<SocialRepository, "resolveTargets">;
  userId: string;
  accountId: string;
  evidenceRefs: readonly string[];
}): Promise<CommercialSocialAccountBinding> {
  return resolveCommercialSocialAccount({
    repository: input.repository,
    userId: input.userId,
    growthBrandId: "brand:pupsonstuff" as GrowthId,
    accountId: input.accountId,
    platform: "instagram",
    evidenceRefs: input.evidenceRefs,
  });
}

export async function resolveFacelessYouTubeVentureAccount(input: {
  repository: Pick<SocialRepository, "resolveTargets">;
  userId: string;
  growthBrandId: GrowthId;
  ventureRef: string;
  accountId: string;
  evidenceRefs: readonly string[];
}): Promise<CommercialSocialAccountBinding> {
  return resolveCommercialSocialAccount({
    repository: input.repository,
    userId: input.userId,
    growthBrandId: input.growthBrandId,
    ventureRef: input.ventureRef,
    accountId: input.accountId,
    platform: "youtube",
    evidenceRefs: input.evidenceRefs,
  });
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

import type { SocialPlatform, SocialProviderName } from "./types.js";

export type SocialProviderCapability =
  | "profiles.discover"
  | "publish"
  | "schedule"
  | "delete"
  | "analytics.post"
  | "analytics.account"
  | "comments.read"
  | "comments.reply"
  | "messages"
  | "media.upload"
  | "media.resize";

export interface SocialProviderDescriptor {
  provider: SocialProviderName;
  transport: "aggregator" | "direct";
  capabilities: readonly SocialProviderCapability[];
  platforms: readonly SocialPlatform[];
  evidenceRefs: readonly string[];
}

const descriptors: readonly SocialProviderDescriptor[] = Object.freeze([
  Object.freeze({
    provider: "hootsuite",
    transport: "aggregator",
    capabilities: Object.freeze([
      "profiles.discover",
      "publish",
      "schedule",
      "delete",
    ] as const),
    platforms: Object.freeze([
      "facebook",
      "instagram",
      "tiktok",
      "youtube",
      "x",
      "linkedin",
    ] as const),
    evidenceRefs: Object.freeze(["repo:packages/social-core/src/hootsuite.ts"]),
  }),
  Object.freeze({
    provider: "ayrshare",
    transport: "aggregator",
    capabilities: Object.freeze([
      "profiles.discover",
      "publish",
      "schedule",
      "delete",
      "analytics.post",
      "analytics.account",
      "comments.read",
      "comments.reply",
      "messages",
      "media.upload",
      "media.resize",
    ] as const),
    platforms: Object.freeze([
      "facebook",
      "instagram",
      "tiktok",
      "youtube",
      "x",
      "linkedin",
      "threads",
      "bluesky",
      "reddit",
      "snapchat",
    ] as const),
    evidenceRefs: Object.freeze([
      "github:ayrshare/social-media-api",
      "docs:https://app.ayrshare.com/docs/apis/post/overview",
    ]),
  }),
]);

export function listSocialProviderDescriptors(): readonly SocialProviderDescriptor[] {
  return descriptors;
}

export function getSocialProviderDescriptor(provider: string): SocialProviderDescriptor {
  const descriptor = descriptors.find((candidate) => candidate.provider === provider);
  if (!descriptor) throw new Error(`SOCIAL_PROVIDER_NOT_REGISTERED:${provider}`);
  return descriptor;
}

export function assertSocialProviderCapability(
  provider: string,
  capability: SocialProviderCapability,
): void {
  const descriptor = getSocialProviderDescriptor(provider);
  if (!descriptor.capabilities.includes(capability)) {
    throw new Error(`SOCIAL_PROVIDER_CAPABILITY_UNAVAILABLE:${provider}:${capability}`);
  }
}

export function assertSocialProviderPlatform(
  provider: string,
  platform: SocialPlatform,
): void {
  const descriptor = getSocialProviderDescriptor(provider);
  if (!descriptor.platforms.includes(platform)) {
    throw new Error(`SOCIAL_PROVIDER_PLATFORM_UNAVAILABLE:${provider}:${platform}`);
  }
}

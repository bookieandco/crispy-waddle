import type {
  JhadinaBrand,
  SocialPublicationProposal,
  SocialPublishTarget,
} from "./types.js";

export const PUBLIC_PUBLISH_CAPABILITY = "public.publish";

export interface SocialPublicationInput {
  brand: JhadinaBrand;
  text: string;
  mediaUrls?: readonly string[];
  scheduledAt?: string;
  targets: readonly SocialPublishTarget[];
}

function normalizedTargets(targets: readonly SocialPublishTarget[]): SocialPublishTarget[] {
  return [...targets].sort((a, b) =>
    [a.provider, a.providerProfileId, a.accountId].join(":").localeCompare(
      [b.provider, b.providerProfileId, b.accountId].join(":"),
    ),
  );
}

export function assertExplicitPublishTargets(
  brand: JhadinaBrand,
  targets: readonly SocialPublishTarget[],
): void {
  if (!targets.length) throw new Error("SOCIAL_TARGETS_REQUIRED");

  const accounts = new Set<string>();
  const providerProfiles = new Set<string>();

  for (const target of targets) {
    if (!target.accountId || !target.providerProfileId) throw new Error("SOCIAL_TARGET_IDENTITY_REQUIRED");
    if (target.brand !== brand) throw new Error("SOCIAL_CROSS_BRAND_TARGET_DENIED");

    const providerKey = `${target.provider}:${target.providerProfileId}`;
    if (accounts.has(target.accountId) || providerProfiles.has(providerKey)) {
      throw new Error("SOCIAL_DUPLICATE_TARGET");
    }
    accounts.add(target.accountId);
    providerProfiles.add(providerKey);
  }
}

export function fingerprintSocialPublication(input: SocialPublicationInput): string {
  const text = input.text.trim();
  if (!text) throw new Error("SOCIAL_TEXT_REQUIRED");
  assertExplicitPublishTargets(input.brand, input.targets);

  return JSON.stringify({
    v: 1,
    brand: input.brand,
    text,
    mediaUrls: [...(input.mediaUrls ?? [])],
    scheduledAt: input.scheduledAt ?? null,
    targets: normalizedTargets(input.targets).map((target) => ({
      accountId: target.accountId,
      provider: target.provider,
      providerProfileId: target.providerProfileId,
      platform: target.platform,
      brand: target.brand,
    })),
  });
}

export interface SocialPublishAction {
  proposalId: string;
  requestFingerprint: string;
}

export function publicationActionFromProposal(
  proposal: Pick<SocialPublicationProposal, "id" | "requestFingerprint">,
): SocialPublishAction {
  return {
    proposalId: proposal.id,
    requestFingerprint: proposal.requestFingerprint,
  };
}

export function fingerprintSocialPublishAction(action: SocialPublishAction): string {
  return `social-public-publish:v1:${action.proposalId}:${action.requestFingerprint}`;
}

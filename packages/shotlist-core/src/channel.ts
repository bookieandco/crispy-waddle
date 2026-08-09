export type ChannelContentStatus = "idea" | "validated" | "planned" | "producing" | "review" | "published" | "archived";
export type ChannelAssetKind = "avatar" | "voice" | "profile" | "banner" | "thumbnail" | "visual" | "video" | "music" | "sfx" | "caption";
export type ChannelMonetizationKind = "ads" | "affiliate" | "sponsor" | "product" | "service";
export type MarketingActionKind = "research" | "draft" | "schedule" | "publish" | "send" | "spend";

export interface ChannelBrand {
  name: string;
  handle?: string;
  niche: string;
  audience: string;
  positioning?: string;
  visualStyle?: string;
  voiceStyle?: string;
}

export interface ChannelAvatar {
  id: string;
  name: string;
  referenceAssetIds: string[];
  voiceId?: string;
  continuityProfile?: Record<string, string>;
}

export interface ChannelAsset {
  id: string;
  kind: ChannelAssetKind;
  uri: string;
  durationMs?: number;
  provenance?: string;
  license?: string;
}

export interface ChannelMonetizationPlan {
  kinds: ChannelMonetizationKind[];
  offers?: string[];
  affiliatePrograms?: string[];
}

export interface ChannelProject {
  id: string;
  brand: ChannelBrand;
  avatar?: ChannelAvatar;
  monetization?: ChannelMonetizationPlan;
  assets: ChannelAsset[];
  status: "draft" | "active" | "paused" | "archived";
}

export interface TopicEvidence {
  sourceUri: string;
  title?: string;
  views?: number;
  publishedAt?: string;
  notes?: string;
}

export interface ChannelVideoPlan {
  id: string;
  channelId: string;
  title: string;
  premise: string;
  targetDurationMs: number;
  status: ChannelContentStatus;
  evidence: TopicEvidence[];
  hook?: string;
  scriptUri?: string;
  assetIds: string[];
  monetization?: ChannelMonetizationKind[];
}

export interface VisualBeat {
  startMs: number;
  endMs: number;
  prompt: string;
  assetKind: "avatar" | "image" | "animation" | "broll" | "infographic" | "text";
  continuityTags?: string[];
}

export interface ChannelProductionPlan {
  video: ChannelVideoPlan;
  visualBeats: VisualBeat[];
  captioned: boolean;
  musicBed?: string;
  thumbnailBrief?: string;
  metadataBrief?: string;
}

export interface MarketingActionPolicy {
  kind: MarketingActionKind;
  approvalRequired: boolean;
  reason?: string;
}

export interface MarketingCampaign {
  id: string;
  channelId?: string;
  name: string;
  objective: "awareness" | "traffic" | "leads" | "sales" | "retention";
  audience?: string;
  offer?: string;
  landingPageId?: string;
  actions: MarketingActionPolicy[];
  status: "draft" | "planned" | "active" | "paused" | "completed";
}

export function defaultMarketingActionPolicy(kind: MarketingActionKind): MarketingActionPolicy {
  return {
    kind,
    approvalRequired: kind === "publish" || kind === "send" || kind === "spend",
    reason: kind === "publish" || kind === "send" || kind === "spend" ? "External action requires explicit approval" : undefined,
  };
}

export function validateChannelProductionPlan(plan: ChannelProductionPlan): string[] {
  const issues: string[] = [];
  if (plan.video.targetDurationMs <= 0) issues.push("targetDurationMs must be positive");
  for (let i = 1; i < plan.visualBeats.length; i += 1) {
    if (plan.visualBeats[i].startMs < plan.visualBeats[i - 1].startMs) {
      issues.push("visual beats must be ordered by startMs");
      break;
    }
  }
  return issues;
}

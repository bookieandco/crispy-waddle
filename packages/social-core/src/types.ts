export type SocialPlatform = "facebook" | "instagram" | "tiktok" | "youtube";

export type JhadinaBrand = "overageos" | "jhadinatv" | "jhadina-music" | "bookieandco";

export type SocialPostStatus = "draft" | "approved" | "scheduled" | "published" | "failed";

export type SocialAutopostMode = "manual" | "approved" | "autopilot";

export interface SocialProfile {
  id: string;
  platform: SocialPlatform;
  name: string;
  handle?: string;
  connected: boolean;
}

export interface SocialPublishTarget {
  profileId: string;
  platform: SocialPlatform;
}

export interface SocialAutopostRule {
  id: string;
  brand: JhadinaBrand;
  enabled: boolean;
  mode: SocialAutopostMode;
  targetProfileIds: string[];
  platforms?: SocialPlatform[];
  cadence?: string;
  timezone?: string;
  nextRunAt?: string;
}

export interface SocialPostDraft {
  id: string;
  brand: JhadinaBrand;
  platforms: SocialPlatform[];
  text: string;
  mediaUrls?: string[];
  scheduledAt?: string;
  status: SocialPostStatus;
  requiresApproval: boolean;
  approvedAt?: string;
  providerPostIds?: Record<string, string>;
  publishTargets?: SocialPublishTarget[];
  autopostRuleId?: string;
}

export interface SocialProvider {
  readonly name: string;
  getProfiles(): Promise<SocialProfile[]>;
  createPost(input: Omit<SocialPostDraft, "id" | "status">): Promise<SocialPostDraft>;
  getPosts(): Promise<SocialPostDraft[]>;
  deletePost(providerPostId: string): Promise<void>;
}

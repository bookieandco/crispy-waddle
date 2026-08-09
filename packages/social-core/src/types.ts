export type SocialPlatform = "facebook" | "instagram" | "tiktok" | "youtube";

export type JhadinaBrand = "overageos" | "jhadinatv" | "jhadina-music" | "bookieandco";

export type SocialPostStatus = "draft" | "approved" | "scheduled" | "published" | "failed";

export interface SocialProfile {
  id: string;
  platform: SocialPlatform;
  name: string;
  handle?: string;
  connected: boolean;
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
}

export interface SocialProvider {
  readonly name: string;
  getProfiles(): Promise<SocialProfile[]>;
  createPost(input: Omit<SocialPostDraft, "id" | "status">): Promise<SocialPostDraft>;
  getPosts(): Promise<SocialPostDraft[]>;
  deletePost(providerPostId: string): Promise<void>;
}

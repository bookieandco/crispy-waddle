export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "linkedin"
  | "threads"
  | "bluesky"
  | "reddit"
  | "snapchat"
  | "tumblr"
  | "vk";

export type JhadinaBrand =
  | "overageos"
  | "jhadinatv"
  | "jhadina-music"
  | "bookieandco"
  | "jhadina"
  | "pupsonstuff"
  | "atwood-bookie";

export type SocialProviderName = "hootsuite" | (string & {});

export type SocialAccountStatus = "connected" | "disabled" | "revoked";
export type SocialPublicationStatus =
  | "pending_approval"
  | "approved"
  | "queued"
  | "partially_delivered"
  | "delivered"
  | "failed"
  | "cancelled";
export type SocialOutboxStatus =
  | "pending"
  | "attempting"
  | "delivered"
  | "failed"
  | "ambiguous"
  | "cancelled";

export interface SocialProfile {
  id: string;
  provider: SocialProviderName;
  platform: SocialPlatform;
  name: string;
  handle?: string;
  connected: boolean;
}

export interface SocialAccount {
  id: string;
  userId: string;
  brand: JhadinaBrand;
  provider: SocialProviderName;
  providerProfileId: string;
  platform: SocialPlatform;
  displayName: string;
  handle?: string;
  status: SocialAccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SocialPublishTarget {
  accountId: string;
  brand: JhadinaBrand;
  provider: SocialProviderName;
  providerProfileId: string;
  platform: SocialPlatform;
}

export interface SocialPublicationProposal {
  id: string;
  userId: string;
  actionId: string;
  brand: JhadinaBrand;
  text: string;
  mediaUrls: string[];
  scheduledAt?: string;
  targets: SocialPublishTarget[];
  status: SocialPublicationStatus;
  requestFingerprint: string;
  idempotencyKey: string;
  approvalReceiptId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialProviderPublishRequest {
  text: string;
  mediaUrls: string[];
  scheduledAt?: string;
  targets: SocialPublishTarget[];
  idempotencyKey: string;
}

export interface SocialProviderDeliveryReceipt {
  provider: SocialProviderName;
  providerProfileId: string;
  platform: SocialPlatform;
  providerPostId: string;
  state: "scheduled" | "published" | "failed" | "unknown";
  observedAt: string;
}

export interface SocialProviderDelivery extends SocialProviderDeliveryReceipt {
  text?: string;
  scheduledAt?: string;
}

export interface SocialOutboxJob {
  id: string;
  proposalId: string;
  userId: string;
  actionId: string;
  target: SocialPublishTarget;
  text: string;
  mediaUrls: string[];
  scheduledAt?: string;
  status: SocialOutboxStatus;
  idempotencyKey: string;
  attemptCount: number;
  providerPostId?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialProvider {
  readonly name: SocialProviderName;
  discoverProfiles(): Promise<SocialProfile[]>;
  publish(input: SocialProviderPublishRequest): Promise<SocialProviderDeliveryReceipt[]>;
  listDeliveries(input?: { since?: string; until?: string }): Promise<SocialProviderDelivery[]>;
  deleteDelivery(providerPostId: string): Promise<void>;
}

/** @deprecated Use SocialPublicationProposal. */
export type SocialPostDraft = SocialPublicationProposal;

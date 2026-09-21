import type {
  SocialProfile,
  SocialProvider,
  SocialProviderDelivery,
  SocialProviderDeliveryReceipt,
  SocialProviderPublishRequest,
} from "./types.js";

const BASE_URL = "https://platform.hootsuite.com";

interface HootsuiteProfile {
  id: string;
  socialNetwork?: string;
  name?: string;
  socialProfile?: { name?: string; handle?: string; externalURL?: string };
}

interface HootsuiteMessage {
  id: string;
  state?: string;
  text?: string;
  scheduledSendTime?: string;
  socialProfile?: { id?: string; externalURL?: string };
}

type Fetcher = typeof fetch;

export interface HootsuiteProviderOptions {
  token?: string;
  fetcher?: Fetcher;
}

export class HootsuiteProvider implements SocialProvider {
  readonly name = "hootsuite" as const;
  private readonly configuredToken?: string;
  private readonly fetcher: Fetcher;

  constructor(options: HootsuiteProviderOptions = {}) {
    this.configuredToken = options.token;
    this.fetcher = options.fetcher ?? fetch;
  }

  private get token(): string {
    const token = this.configuredToken ?? process.env.HOOTSUITE_ACCESS_TOKEN;
    if (!token) throw new Error("HOOTSUITE_ACCESS_TOKEN is not configured");
    return token;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetcher(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const record = body as { errors?: Array<{ message?: string }> };
      const message = Array.isArray(record.errors)
        ? record.errors.map((error) => error.message).filter(Boolean).join("; ")
        : `Hootsuite request failed with ${response.status}`;
      throw new Error(message || `Hootsuite request failed with ${response.status}`);
    }
    return (body as { data?: T }).data as T;
  }

  async discoverProfiles(): Promise<SocialProfile[]> {
    const profiles = await this.request<HootsuiteProfile[]>("/v1/me/socialProfiles");
    return (profiles ?? []).map((profile) => ({
      id: profile.id,
      provider: this.name,
      platform: normalizeHootsuitePlatform(profile.socialNetwork),
      name: profile.socialProfile?.name ?? profile.name ?? profile.id,
      handle: profile.socialProfile?.handle,
      connected: true,
    }));
  }

  async publish(input: SocialProviderPublishRequest): Promise<SocialProviderDeliveryReceipt[]> {
    if (!input.targets.length) throw new Error("SOCIAL_TARGETS_REQUIRED");

    const seen = new Set<string>();
    for (const target of input.targets) {
      if (target.provider !== this.name) throw new Error("SOCIAL_PROVIDER_TARGET_MISMATCH");
      if (seen.has(target.providerProfileId)) throw new Error("SOCIAL_DUPLICATE_TARGET");
      seen.add(target.providerProfileId);
    }

    const payload: Record<string, unknown> = {
      text: input.text,
      socialProfileIds: input.targets.map((target) => target.providerProfileId),
      mediaUrls: input.mediaUrls,
    };
    if (input.scheduledAt) payload.scheduledSendTime = new Date(input.scheduledAt).toISOString();

    const messages = await this.request<HootsuiteMessage[]>("/v1/messages", {
      method: "POST",
      headers: { "Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify(payload),
    });

    const observedAt = new Date().toISOString();
    return input.targets.map((target) => {
      const message = (messages ?? []).find(
        (candidate) => candidate.socialProfile?.id === target.providerProfileId,
      );
      if (!message?.id) throw new Error("HOOTSUITE_AMBIGUOUS_DELIVERY_RECEIPT");
      return {
        provider: this.name,
        providerProfileId: target.providerProfileId,
        platform: target.platform,
        providerPostId: message.id,
        state: normalizeHootsuiteStatus(message.state),
        observedAt,
      };
    });
  }

  async listDeliveries(input: { since?: string; until?: string } = {}): Promise<SocialProviderDelivery[]> {
    const end = input.until ? new Date(input.until) : new Date();
    const start = input.since ? new Date(input.since) : new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const profiles = await this.discoverProfiles();
    const query = new URLSearchParams({
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      limit: "100",
    });
    const messages = await this.request<HootsuiteMessage[]>(`/v1/messages?${query.toString()}`);

    return (messages ?? []).flatMap((message) => {
      const profile = profiles.find((candidate) => candidate.id === message.socialProfile?.id);
      if (!profile) return [];
      return [{
        provider: this.name,
        providerProfileId: profile.id,
        platform: profile.platform,
        providerPostId: message.id,
        state: normalizeHootsuiteStatus(message.state),
        observedAt: new Date().toISOString(),
        text: message.text,
        scheduledAt: message.scheduledSendTime,
      }];
    });
  }

  async deleteDelivery(providerPostId: string): Promise<void> {
    await this.request(`/v1/messages/${providerPostId}`, { method: "DELETE" });
  }
}

export function normalizeHootsuitePlatform(value?: string): SocialProfile["platform"] {
  switch ((value ?? "").toUpperCase()) {
    case "FACEBOOKPAGE": return "facebook";
    case "INSTAGRAMBUSINESS": return "instagram";
    case "TIKTOKBUSINESS": return "tiktok";
    case "YOUTUBECHANNEL": return "youtube";
    case "TWITTERPROFILE":
    case "TWITTER": return "x";
    case "LINKEDINCOMPANY":
    case "LINKEDINPROFILE": return "linkedin";
    default: throw new Error(`HOOTSUITE_UNSUPPORTED_SOCIAL_NETWORK:${value ?? "unknown"}`);
  }
}

export function normalizeHootsuiteStatus(value?: string): SocialProviderDeliveryReceipt["state"] {
  switch (value) {
    case "SCHEDULED":
    case "PENDING_APPROVAL": return "scheduled";
    case "SENT": return "published";
    case "SEND_FAILED_PERMANENTLY": return "failed";
    default: return "unknown";
  }
}

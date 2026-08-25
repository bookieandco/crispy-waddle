import type { SocialPostDraft, SocialProfile, SocialProvider } from "./types";

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

export class HootsuiteProvider implements SocialProvider {
  readonly name = "hootsuite";

  private get token(): string {
    const token = process.env.HOOTSUITE_ACCESS_TOKEN;
    if (!token) throw new Error("HOOTSUITE_ACCESS_TOKEN is not configured");
    return token;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
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
      const message = Array.isArray(body?.errors)
        ? body.errors.map((e: { message?: string }) => e.message).filter(Boolean).join("; ")
        : `Hootsuite request failed with ${response.status}`;
      throw new Error(message);
    }
    return body?.data as T;
  }

  async getProfiles(): Promise<SocialProfile[]> {
    const profiles = await this.request<HootsuiteProfile[]>("/v1/me/socialProfiles");
    return (profiles ?? []).map((profile) => ({
      id: profile.id,
      platform: normalizePlatform(profile.socialNetwork),
      name: profile.socialProfile?.name ?? profile.name ?? profile.id,
      handle: profile.socialProfile?.handle,
      connected: true,
    }));
  }

  async createPost(input: Omit<SocialPostDraft, "id" | "status">): Promise<SocialPostDraft> {
    if (input.requiresApproval && !input.approvedAt) {
      throw new Error("Social post requires approval before provider submission");
    }

    const profiles = await this.getProfiles();
    const targetIds = profiles
      .filter((profile) => input.platforms.includes(profile.platform))
      .map((profile) => profile.id);

    if (!targetIds.length) throw new Error("No connected Hootsuite profiles match the requested platforms");
    if (!input.scheduledAt) throw new Error("scheduledAt is required for Hootsuite publishing");

    const messages = await this.request<HootsuiteMessage[]>("/v1/messages", {
      method: "POST",
      body: JSON.stringify({
        text: input.text,
        socialProfileIds: targetIds,
        scheduledSendTime: new Date(input.scheduledAt).toISOString(),
        mediaUrls: input.mediaUrls ?? [],
      }),
    });

    const providerPostIds: Record<string, string> = {};
    for (const message of messages ?? []) {
      const profile = profiles.find((p) => p.id === message.socialProfile?.id);
      if (profile) providerPostIds[profile.platform] = message.id;
    }

    return {
      ...input,
      id: `hs:${Date.now()}`,
      status: "scheduled",
      providerPostIds,
    };
  }

  async getPosts(): Promise<SocialPostDraft[]> {
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const query = new URLSearchParams({
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      limit: "100",
    });
    const messages = await this.request<HootsuiteMessage[]>(`/v1/messages?${query.toString()}`);
    const profiles = await this.getProfiles();

    return (messages ?? []).map((message) => {
      const profile = profiles.find((p) => p.id === message.socialProfile?.id);
      return {
        id: `hs:${message.id}`,
        brand: "jhadinatv",
        platforms: profile ? [profile.platform] : [],
        text: message.text ?? "",
        scheduledAt: message.scheduledSendTime,
        status: normalizeStatus(message.state),
        requiresApproval: false,
        providerPostIds: profile
          ? { [profile.platform]: message.id }
          : { hootsuite: message.id },
      };
    });
  }

  async deletePost(providerPostId: string): Promise<void> {
    await this.request(`/v1/messages/${providerPostId}`, { method: "DELETE" });
  }
}

function normalizePlatform(value?: string): SocialProfile["platform"] {
  switch ((value ?? "").toUpperCase()) {
    case "FACEBOOKPAGE": return "facebook";
    case "INSTAGRAMBUSINESS": return "instagram";
    case "TIKTOKBUSINESS": return "tiktok";
    case "YOUTUBECHANNEL": return "youtube";
    default: return "facebook";
  }
}

function normalizeStatus(value?: string): SocialPostDraft["status"] {
  switch (value) {
    case "SCHEDULED": return "scheduled";
    case "SENT": return "published";
    case "PENDING_APPROVAL": return "approved";
    case "SEND_FAILED_PERMANENTLY": return "failed";
    default: return "draft";
  }
}

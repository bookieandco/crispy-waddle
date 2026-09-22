import type {
  SocialPlatform,
  SocialProfile,
  SocialProvider,
  SocialProviderDelivery,
  SocialProviderDeliveryReceipt,
  SocialProviderPublishRequest,
} from "./types.js";
import { assertSocialProviderPlatform } from "./provider-capabilities.js";

const BASE_URL = "https://api.ayrshare.com/api";

type Fetcher = typeof fetch;

export interface AyrshareProfileBinding {
  id: string;
  profileKey: string;
  platform: SocialPlatform;
  name: string;
  handle?: string;
}

export interface AyrshareProviderOptions {
  apiKey?: string;
  bindings?: readonly AyrshareProfileBinding[];
  fetcher?: Fetcher;
}

interface AyrsharePostResult {
  id?: string;
  status?: string;
  message?: string;
  post?: string;
  scheduleDate?: string;
  platforms?: string[];
  postIds?: Array<{
    id?: string;
    platform?: string;
    status?: string;
    postUrl?: string;
  }>;
}

export class AyrshareProvider implements SocialProvider {
  readonly name = "ayrshare" as const;
  private readonly configuredApiKey?: string;
  private readonly bindings: readonly AyrshareProfileBinding[];
  private readonly fetcher: Fetcher;

  constructor(options: AyrshareProviderOptions = {}) {
    this.configuredApiKey = options.apiKey;
    this.bindings = Object.freeze([...(options.bindings ?? [])]);
    this.fetcher = options.fetcher ?? fetch;
    for (const binding of this.bindings) {
      if (!binding.id.trim() || !binding.profileKey.trim() || !binding.name.trim()) {
        throw new Error("AYRSHARE_BINDING_INVALID");
      }
      assertSocialProviderPlatform(this.name, binding.platform);
    }
  }

  private get apiKey(): string {
    const value = this.configuredApiKey ?? process.env.AYRSHARE_API_KEY;
    if (!value) throw new Error("AYRSHARE_API_KEY is not configured");
    return value;
  }

  private binding(id: string): AyrshareProfileBinding {
    const binding = this.bindings.find((candidate) => candidate.id === id);
    if (!binding) throw new Error(`AYRSHARE_PROFILE_BINDING_NOT_FOUND:${id}`);
    return binding;
  }

  private async request<T>(
    path: string,
    input: {
      method?: "GET" | "POST" | "DELETE";
      profileKey?: string;
      body?: Record<string, unknown>;
      query?: URLSearchParams;
    } = {},
  ): Promise<T> {
    const query = input.query?.toString();
    const response = await this.fetcher(`${BASE_URL}/${path}${query ? `?${query}` : ""}`, {
      method: input.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(input.profileKey ? { "Profile-Key": input.profileKey } : {}),
      },
      ...(input.body ? { body: JSON.stringify(input.body) } : {}),
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const record = body as { message?: string; error?: string };
      throw new Error(record.message || record.error || `Ayrshare request failed with ${response.status}`);
    }
    const record = body as { status?: string; message?: string };
    if (record.status === "error") {
      throw new Error(record.message || "Ayrshare reported an error");
    }
    return body as T;
  }

  async discoverProfiles(): Promise<SocialProfile[]> {
    return this.bindings.map((binding) => ({
      id: binding.id,
      provider: this.name,
      platform: binding.platform,
      name: binding.name,
      handle: binding.handle,
      connected: true,
    }));
  }

  async publish(input: SocialProviderPublishRequest): Promise<SocialProviderDeliveryReceipt[]> {
    if (input.targets.length !== 1) {
      throw new Error("AYRSHARE_EXACTLY_ONE_TARGET_REQUIRED");
    }
    const target = input.targets[0];
    if (target.provider !== this.name) throw new Error("SOCIAL_PROVIDER_TARGET_MISMATCH");
    const binding = this.binding(target.providerProfileId);
    if (binding.platform !== target.platform) throw new Error("SOCIAL_PROVIDER_TARGET_PLATFORM_MISMATCH");

    const result = await this.request<AyrsharePostResult>("post", {
      method: "POST",
      profileKey: binding.profileKey,
      body: {
        post: input.text,
        platforms: [target.platform],
        mediaUrls: input.mediaUrls,
        idempotencyKey: input.idempotencyKey,
        ...(input.scheduledAt ? { scheduleDate: new Date(input.scheduledAt).toISOString() } : {}),
      },
    });

    if (!result.id) throw new Error("AYRSHARE_AMBIGUOUS_DELIVERY_RECEIPT");
    const platformResult = result.postIds?.find((item) => item.platform === target.platform);
    const state = input.scheduledAt
      ? "scheduled"
      : normalizeAyrshareStatus(platformResult?.status ?? result.status);

    return [{
      provider: this.name,
      providerProfileId: target.providerProfileId,
      platform: target.platform,
      providerPostId: result.id,
      state,
      observedAt: new Date().toISOString(),
    }];
  }

  async listDeliveries(input: { since?: string; until?: string } = {}): Promise<SocialProviderDelivery[]> {
    const now = input.until ? new Date(input.until) : new Date();
    const since = input.since ? new Date(input.since) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const days = Math.max(1, Math.min(90, Math.ceil((now.getTime() - since.getTime()) / 86_400_000) + 1));
    const deliveries: SocialProviderDelivery[] = [];

    for (const binding of this.bindings) {
      const result = await this.request<unknown>("history", {
        profileKey: binding.profileKey,
        query: new URLSearchParams({ lastDays: String(days) }),
      });
      const history = normalizeAyrshareHistory(result);
      for (const item of history) {
        if (!item.id) continue;
        const platforms = new Set([
          ...(item.platforms ?? []),
          ...(item.postIds ?? []).map((candidate) => candidate.platform).filter((value): value is string => !!value),
        ]);
        if (platforms.size && !platforms.has(binding.platform)) continue;
        const platformState = item.postIds?.find((candidate) => candidate.platform === binding.platform)?.status;
        deliveries.push({
          provider: this.name,
          providerProfileId: binding.id,
          platform: binding.platform,
          providerPostId: item.id,
          state: normalizeAyrshareStatus(platformState ?? item.status),
          observedAt: new Date().toISOString(),
          text: item.post,
          scheduledAt: item.scheduleDate,
        });
      }
    }
    return deliveries;
  }

  async deleteDelivery(providerPostId: string): Promise<void> {
    const matches = await this.listDeliveries({ since: new Date(Date.now() - 90 * 86_400_000).toISOString() });
    const match = matches.find((candidate) => candidate.providerPostId === providerPostId);
    if (!match) throw new Error("AYRSHARE_DELIVERY_NOT_FOUND");
    const binding = this.binding(match.providerProfileId);
    await this.request("post", {
      method: "DELETE",
      profileKey: binding.profileKey,
      body: { id: providerPostId },
    });
  }
}

export function normalizeAyrshareStatus(value?: string): SocialProviderDeliveryReceipt["state"] {
  switch ((value ?? "").toLowerCase()) {
    case "success":
    case "sent":
    case "published":
      return "published";
    case "scheduled":
    case "pending":
    case "awaiting approval":
    case "awaiting_approval":
      return "scheduled";
    case "error":
    case "failed":
    case "failure":
      return "failed";
    default:
      return "unknown";
  }
}

export function normalizeAyrshareHistory(value: unknown): AyrsharePostResult[] {
  if (Array.isArray(value)) return value as AyrsharePostResult[];
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of ["history", "posts", "data"]) {
    if (Array.isArray(record[key])) return record[key] as AyrsharePostResult[];
  }
  return [];
}

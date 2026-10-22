import { describe, expect, it, vi } from "vitest";
import { AyrshareProvider, normalizeAyrshareAnalytics, normalizeAyrshareHistory, normalizeAyrshareMetrics, normalizeAyrshareStatus } from "./ayrshare.js";

describe("AyrshareProvider", () => {
  it("publishes one exact target with provider idempotency", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      expect(body.platforms).toEqual(["linkedin"]);
      expect(body.idempotencyKey).toBe("idem-1");
      expect((init?.headers as Record<string, string>)["Profile-Key"]).toBe("secret-profile");
      return new Response(JSON.stringify({
        status: "success",
        id: "ayr-post-1",
        postIds: [{ platform: "linkedin", status: "success", id: "li-1" }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    const provider = new AyrshareProvider({
      apiKey: "api",
      fetcher,
      bindings: [{
        id: "linkedin-main",
        profileKey: "secret-profile",
        platform: "linkedin",
        name: "Main LinkedIn",
      }],
    });

    const result = await provider.publish({
      text: "Hello",
      mediaUrls: [],
      targets: [{
        accountId: "acct-1",
        brand: "jhadina",
        provider: "ayrshare",
        providerProfileId: "linkedin-main",
        platform: "linkedin",
      }],
      idempotencyKey: "idem-1",
    });

    expect(result).toHaveLength(1);
    expect(result[0].providerPostId).toBe("ayr-post-1");
    expect(result[0].state).toBe("published");
  });

  it("loads post analytics with the exact bound profile key", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toContain("/analytics/post");
      expect((init?.headers as Record<string, string>)["Profile-Key"]).toBe("secret-profile");
      expect(JSON.parse(String(init?.body))).toEqual({
        id: "li-post-1",
        platforms: ["linkedin"],
      });
      return new Response(JSON.stringify({
        linkedin: {
          id: "li-post-1",
          postUrl: "https://linkedin.example/post/1",
          analytics: {
            impressionCount: 1000,
            clickCount: 42,
            engagement: 88,
            likeCount: 30,
          },
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    const provider = new AyrshareProvider({
      apiKey: "api",
      fetcher,
      bindings: [{
        id: "linkedin-main",
        profileKey: "secret-profile",
        platform: "linkedin",
        name: "Main LinkedIn",
      }],
    });
    const result = await provider.getPostAnalytics({
      providerProfileId: "linkedin-main",
      platform: "linkedin",
      providerPostId: "li-post-1",
    });
    expect(result).toMatchObject({
      provider: "ayrshare",
      providerProfileId: "linkedin-main",
      platform: "linkedin",
      contentId: "li-post-1",
      sourceUrl: "https://linkedin.example/post/1",
      metrics: {
        impressionCount: 1000,
        clickCount: 42,
        engagement: 88,
        likeCount: 30,
        impressions: 1000,
        clicks: 42,
        engagements: 88,
      },
    });
  });

  it("fails closed when a provider alias is not configured", async () => {
    const provider = new AyrshareProvider({
      apiKey: "api",
      bindings: [],
      fetcher: vi.fn() as unknown as typeof fetch,
    });

    await expect(provider.publish({
      text: "Hello",
      mediaUrls: [],
      targets: [{
        accountId: "acct-1",
        brand: "jhadina",
        provider: "ayrshare",
        providerProfileId: "missing",
        platform: "linkedin",
      }],
      idempotencyKey: "idem",
    })).rejects.toThrow("AYRSHARE_PROFILE_BINDING_NOT_FOUND");
  });
});

describe("Ayrshare normalization", () => {
  it("normalizes provider delivery states conservatively", () => {
    expect(normalizeAyrshareStatus("success")).toBe("published");
    expect(normalizeAyrshareStatus("scheduled")).toBe("scheduled");
    expect(normalizeAyrshareStatus("failed")).toBe("failed");
    expect(normalizeAyrshareStatus("mystery")).toBe("unknown");
  });

  it("normalizes analytics without inventing conversions", () => {
    const metrics = normalizeAyrshareMetrics({
      impressionsCount: 1200,
      videoViews: 700,
      likeCount: 25,
      commentsCount: 5,
      shareCount: 3,
      clicksUnique: 9,
    });
    expect(metrics.impressions).toBe(1200);
    expect(metrics.views).toBe(700);
    expect(metrics.engagements).toBe(33);
    expect(metrics.clicks).toBeUndefined();
    expect(metrics.purchases).toBeUndefined();
    expect(metrics.conversions).toBeUndefined();
  });

  it("normalizes nested platform analytics envelopes", () => {
    const result = normalizeAyrshareAnalytics({
      value: {
        instagram: {
          id: "ig-post-1",
          analytics: { impressionsCount: 318000, videoViews: 95200 },
        },
      },
      providerProfileId: "ig-main",
      platform: "instagram",
      observedAt: "2026-10-04T00:30:00.000Z",
    });
    expect(result.contentId).toBe("ig-post-1");
    expect(result.metrics).toMatchObject({ impressions: 318000, views: 95200 });
  });

  it("normalizes supported history envelopes", () => {
    expect(normalizeAyrshareHistory([{ id: "1" }])).toHaveLength(1);
    expect(normalizeAyrshareHistory({ history: [{ id: "2" }] })).toHaveLength(1);
    expect(normalizeAyrshareHistory({ data: [{ id: "3" }] })).toHaveLength(1);
  });
});

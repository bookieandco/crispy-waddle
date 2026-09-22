import { describe, expect, it, vi } from "vitest";
import { AyrshareProvider, normalizeAyrshareHistory, normalizeAyrshareStatus } from "./ayrshare.js";

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

  it("normalizes supported history envelopes", () => {
    expect(normalizeAyrshareHistory([{ id: "1" }])).toHaveLength(1);
    expect(normalizeAyrshareHistory({ history: [{ id: "2" }] })).toHaveLength(1);
    expect(normalizeAyrshareHistory({ data: [{ id: "3" }] })).toHaveLength(1);
  });
});

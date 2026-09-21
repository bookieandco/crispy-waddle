import { describe, expect, it, vi } from "vitest";
import { HootsuiteProvider, normalizeHootsuitePlatform } from "./hootsuite.js";

describe("HootsuiteProvider", () => {
  it("fails closed for unknown social networks", () => {
    expect(() => normalizeHootsuitePlatform("MYSTERY_NETWORK")).toThrow(
      "HOOTSUITE_UNSUPPORTED_SOCIAL_NETWORK",
    );
  });

  it("submits only the explicitly requested provider profile", async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { socialProfileIds?: string[] };
      expect(body.socialProfileIds).toEqual(["profile-2"]);
      return new Response(JSON.stringify({
        data: [{ id: "message-2", state: "SCHEDULED", socialProfile: { id: "profile-2" } }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    });

    const provider = new HootsuiteProvider({ token: "test-token", fetcher });
    const receipts = await provider.publish({
      text: "hello",
      mediaUrls: [],
      idempotencyKey: "proposal-1:account-2",
      targets: [{
        accountId: "account-2",
        brand: "jhadinatv",
        provider: "hootsuite",
        providerProfileId: "profile-2",
        platform: "tiktok",
      }],
    });

    expect(receipts).toHaveLength(1);
    expect(receipts[0].providerProfileId).toBe("profile-2");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

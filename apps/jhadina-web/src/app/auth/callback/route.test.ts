import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { JHADINA_PERSONAL_OWNER_EMAIL } from "@/lib/auth/personal-owner";

const mocked = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("../../../lib/supabase/server", () => ({
  createClient: async () => ({ auth: mocked }),
}));

import { GET } from "./route";

const request = (query: string) => new NextRequest("https://private.vercel.app/auth/callback?" + query);

describe("legacy email-link callback uses canonical owner-only verification", () => {
  beforeEach(() => {
    mocked.exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
    mocked.getUser.mockReset().mockResolvedValue({ data: { user: {
      id: "verified-owner", email: JHADINA_PERSONAL_OWNER_EMAIL,
      email_confirmed_at: "2026-10-20T00:00:00Z", is_anonymous: false,
    } }, error: null });
    mocked.signOut.mockReset().mockResolvedValue({ error: null });
  });

  it("accepts an owner PKCE code on the current origin with no-cache headers", async () => {
    const res = await GET(request("code=valid-code&next=%2Fsettings%2Fsecurity"));
    expect(mocked.exchangeCodeForSession).toHaveBeenCalledWith("valid-code");
    expect(res.headers.get("location")).toBe("https://private.vercel.app/settings/security");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("rejects an exchanged non-owner session and clears it", async () => {
    mocked.getUser.mockResolvedValueOnce({ data: { user: {
      id: "other-user", email: "other@example.invalid",
      email_confirmed_at: "2026-10-20T00:00:00Z", is_anonymous: false,
    } }, error: null });
    const res = await GET(request("code=valid-code&next=%2Fwork"));
    expect(res.headers.get("location")).toContain("/login?error=confirmation_failed");
    expect(mocked.signOut).toHaveBeenCalledOnce();
  });

  it("never sends a credential or an external next URL into a redirect", async () => {
    const res = await GET(request("code=sensitive-code&next=https%3A%2F%2Fevil.invalid"));
    expect(res.headers.get("location")).toBe("https://private.vercel.app/");
    expect(res.headers.get("location")).not.toContain("sensitive-code");
  });

  it("rejects missing and overlong codes without a provider exchange", async () => {
    const missing = await GET(request("next=%2Fwork"));
    const overlong = await GET(request("code=" + "x".repeat(4097) + "&next=%2Fwork"));
    expect(missing.headers.get("location")).toContain("confirmation_failed");
    expect(overlong.headers.get("location")).toContain("confirmation_failed");
    expect(mocked.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

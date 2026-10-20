import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocked = vi.hoisted(() => ({
  createClient: vi.fn(),
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../../../lib/supabase/server", () => ({
  createClient: mocked.createClient,
}));

import { GET } from "./route";

describe("Supabase confirmation and PKCE callback on private Jhadina previews", () => {
  beforeEach(() => {
    mocked.createClient.mockReset();
    mocked.verifyOtp.mockReset();
    mocked.exchangeCodeForSession.mockReset();
    mocked.getUser.mockReset();
    mocked.signOut.mockReset();
    mocked.getUser.mockResolvedValue({ data: { user: {
      id: "verified-owner", email: "dorianmorris8@icloud.com",
      email_confirmed_at: "2026-10-20T08:00:00Z", is_anonymous: false,
    } }, error: null });
    mocked.signOut.mockResolvedValue({ error: null });
    mocked.createClient.mockResolvedValue({ auth: {
      verifyOtp: mocked.verifyOtp,
      exchangeCodeForSession: mocked.exchangeCodeForSession,
      getUser: mocked.getUser,
      signOut: mocked.signOut,
    } });
  });

  it("accepts an authenticated email token and keeps destination on this origin", async () => {
    mocked.verifyOtp.mockResolvedValue({ error: null });
    const req = new NextRequest("https://private.vercel.app/auth/confirm?token_hash=owner-safe-token&type=email&next=%2Fsettings%2Fsecurity");
    const res = await GET(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get("location")).toBe("https://private.vercel.app/settings/security");
    expect(mocked.verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "owner-safe-token" });
  });

  it("accepts a PKCE code and preserves query on a safe next path", async () => {
    mocked.exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(new NextRequest("https://private.vercel.app/auth/confirm?code=abc&next=%2Fmemory%2Ffacebook%3Freview%3Dyes"));
    expect(mocked.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(res.headers.get("location")).toBe("https://private.vercel.app/memory/facebook?review=yes");
  });

  it("rejects cross-origin next targets even after a verified session", async () => {
    mocked.exchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(new NextRequest("https://private.vercel.app/auth/confirm?code=abc&next=https%3A%2F%2Fevil.invalid"));
    expect(res.headers.get("location")).toBe("https://private.vercel.app/");
  });

  it("rejects non-owner or unverified confirmation and ends that session", async () => {
    mocked.verifyOtp.mockResolvedValue({ error: null });
    mocked.getUser.mockResolvedValueOnce({ data: { user: {
      id: "system", email: "director-certification@system.jhadina.test",
      email_confirmed_at: "2026-10-20T08:00:00Z", is_anonymous: false,
    } }, error: null });
    const res = await GET(new NextRequest("https://private.vercel.app/auth/confirm?token_hash=invalid-owner&type=email"));
    expect(res.headers.get("location")).toContain("confirmation_failed");
    expect(mocked.signOut).toHaveBeenCalledOnce();
  });

  it("does not confirm on provider errors or missing tokens", async () => {
    mocked.exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid" } });
    const bad = await GET(new NextRequest("https://private.vercel.app/auth/confirm?code=broken"));
    expect(bad.headers.get("location")).toBe("https://private.vercel.app/login?error=confirmation_failed&next=%2F");
    const missing = await GET(new NextRequest("https://private.vercel.app/auth/confirm"));
    expect(missing.headers.get("location")).toContain("error=confirmation_failed");
    expect(mocked.createClient).toHaveBeenCalledTimes(1);
  });
});

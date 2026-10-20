import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), getClaims: vi.fn(), getUser: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));
import { updateSession } from "./middleware";

const owner = { id: "real-owner", email: "dorianmorris8@icloud.com", email_confirmed_at: "2026-10-20T07:00:00Z", is_anonymous: false };

describe("Face ID owner-only protected middleware", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset(); mocks.getClaims.mockReset(); mocks.getUser.mockReset();
    mocks.createServerClient.mockReturnValue({ auth: { getClaims: mocks.getClaims, getUser: mocks.getUser } });
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "real-owner" } } });
    mocks.getUser.mockResolvedValue({ data: { user: owner }, error: null });
  });
  it("admits a verified human owner on a protected route", async () => {
    const res = await updateSession(new NextRequest("https://private.vercel.app/ask-jhadina"));
    expect(res.status).toBe(200);
    expect(mocks.getUser).toHaveBeenCalledOnce();
  });
  it("rejects the internal certification user even with valid JWT claims", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { ...owner, email: "director-certification@system.jhadina.test" } }, error: null });
    const res = await updateSession(new NextRequest("https://private.vercel.app/ask-jhadina"));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get("location")).toContain("owner_access_required");
  });
  it("rejects missing email confirmation despite valid claims", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { ...owner, email_confirmed_at: null } }, error: null });
    const res = await updateSession(new NextRequest("https://private.vercel.app/api/jhadina/command"));
    expect(res.headers.get("location")).toContain("/login");
  });
  it("fails closed on provider outage", async () => {
    mocks.getUser.mockRejectedValueOnce(new Error("DB unavailable"));
    const res = await updateSession(new NextRequest("https://private.vercel.app/ask-jhadina"));
    expect(res.headers.get("location")).toContain("/login");
  });
  it("does not change existing machine-route bearer authorization", async () => {
    const res = await updateSession(new NextRequest("https://private.vercel.app/api/health"));
    expect(res.status).toBe(200);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });
  it("does not block the public verified-link callback", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: null } });
    const res = await updateSession(new NextRequest("https://private.vercel.app/auth/confirm?code=sample"));
    expect(res.status).toBe(200);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JHADINA_PERSONAL_OWNER_EMAIL } from "@/lib/auth/personal-owner";

const mocked = vi.hoisted(() => ({
  createClient: vi.fn(),
  signInWithOtp: vi.fn(),
}));

vi.mock("../../lib/supabase/server", () => ({ createClient: mocked.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (destination: string) => { throw new Error("TEST_REDIRECT:" + destination); },
}));

import { sendOwnerSignInLink } from "./actions";

function request(email: string) {
  const form = new FormData();
  form.set("email", email);
  return form;
}

describe("private owner email-link login", () => {
  beforeEach(() => {
    mocked.createClient.mockReset();
    mocked.signInWithOtp.mockReset();
    mocked.createClient.mockResolvedValue({ auth: { signInWithOtp: mocked.signInWithOtp } });
    mocked.signInWithOtp.mockResolvedValue({ error: null });
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "owner-preview-abc.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("only requests a link for the existing owner, never creating a second account", async () => {
    await expect(sendOwnerSignInLink(request(JHADINA_PERSONAL_OWNER_EMAIL)))
      .rejects.toThrow("TEST_REDIRECT:/login?message=check_email");

    expect(mocked.signInWithOtp).toHaveBeenCalledOnce();
    expect(mocked.signInWithOtp).toHaveBeenCalledWith({
      email: JHADINA_PERSONAL_OWNER_EMAIL,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: "https://owner-preview-abc.vercel.app/auth/confirm?next=%2Fsettings%2Fsecurity",
      },
    });
  });

  it("does not call the provider for a different or malformed email", async () => {
    await expect(sendOwnerSignInLink(request("someone-else@example.test")))
      .rejects.toThrow("TEST_REDIRECT:/login?message=check_email");
    expect(mocked.createClient).not.toHaveBeenCalled();
    expect(mocked.signInWithOtp).not.toHaveBeenCalled();
  });

  it("does not report delivery if the email provider rejects the request", async () => {
    mocked.signInWithOtp.mockResolvedValue({ error: { status: 429, message: "email limit" } });
    await expect(sendOwnerSignInLink(request(JHADINA_PERSONAL_OWNER_EMAIL)))
      .rejects.toThrow("TEST_REDIRECT:/login?error=rate_limited");
  });
});

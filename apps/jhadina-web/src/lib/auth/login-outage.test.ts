import { describe, expect, it } from "vitest";
import { authConfirmationOrigin, authFailureCode, authPageErrorMessage } from "./login-outage";

describe("phone login and signup during Supabase outages", () => {
  it("distinguishes upstream outages and rate limiting from incorrect credentials", () => {
    expect(authFailureCode({ status: 503 }, "invalid_credentials")).toBe("service_unavailable");
    expect(authFailureCode({ status: 500 }, "signup_failed")).toBe("service_unavailable");
    expect(authFailureCode({ name: "AuthRetryableFetchError" }, "invalid_credentials")).toBe("service_unavailable");
    expect(authFailureCode(new Error("offline"), "invalid_credentials")).toBe("invalid_credentials");
    expect(authFailureCode(null, "signup_failed")).toBe("service_unavailable");
    expect(authFailureCode({ status: 429 }, "invalid_credentials")).toBe("rate_limited");
    expect(authFailureCode({ status: 429, code: "over_email_send_rate_limit" }, "signup_failed")).toBe("rate_limited");
    expect(authPageErrorMessage("rate_limited")).toContain("email sending limit");
    expect(authFailureCode({ status: 400 }, "invalid_credentials")).toBe("invalid_credentials");
  });

  it("provides a useful, non-secret login error instead of an inert button", () => {
    expect(authPageErrorMessage("service_unavailable")).toContain("temporarily unavailable");
    expect(authPageErrorMessage("invalid_credentials")).toContain("Check your email");
    expect(authPageErrorMessage("session_not_established")).toContain("secure sign-in session");
    expect(authPageErrorMessage("unknown_code")).toBe("Authentication could not be completed.");
    expect(authPageErrorMessage("password_mismatch")).toContain("do not match");
    expect(authPageErrorMessage("password_session_required")).toContain("expired");
    expect(authPageErrorMessage("recovery_rate_limited")).toContain("Too many");
  });

  it("never uses a localhost callback in Vercel production", () => {
    expect(authConfirmationOrigin({ vercelEnv: "production" }))
      .toBe("https://crispy-waddle-jhadina-web.vercel.app");
    expect(authConfirmationOrigin({ vercelEnv: "production", siteUrl: "http://localhost:3000" }))
      .toBe("https://crispy-waddle-jhadina-web.vercel.app");
    expect(authConfirmationOrigin({ vercelEnv: "production", siteUrl: "http://unsafe.example" }))
      .toBe("https://crispy-waddle-jhadina-web.vercel.app");
    expect(authConfirmationOrigin({ vercelEnv: "production", siteUrl: "https://jhadina.example.com/path" }))
      .toBe("https://jhadina.example.com");
    expect(authConfirmationOrigin({ vercelEnv: "development" }))
      .toBe("http://localhost:3000");
    expect(authConfirmationOrigin({ vercelEnv: "preview", vercelUrl: "jhadina-private-bookieandcos-projects.vercel.app" }))
      .toBe("https://jhadina-private-bookieandcos-projects.vercel.app");
    expect(authConfirmationOrigin({ vercelEnv: "preview", vercelUrl: "evil.example.com" }))
      .toBe("https://crispy-waddle-jhadina-web.vercel.app");
    expect(authConfirmationOrigin({ vercelEnv: "preview", vercelUrl: "localhost:3000" }))
      .toBe("https://crispy-waddle-jhadina-web.vercel.app");
    expect(authConfirmationOrigin({ vercelEnv: "preview", siteUrl: "http://localhost:3000", vercelUrl: "safe-preview.vercel.app" }))
      .toBe("https://safe-preview.vercel.app");
    expect(authConfirmationOrigin({ vercelEnv: "production", siteUrl: "https://localhost:3000" }))
      .toBe("https://crispy-waddle-jhadina-web.vercel.app");
    expect(authConfirmationOrigin({ vercelEnv: "preview" }))
      .toBe("https://crispy-waddle-jhadina-web.vercel.app");
  });
});

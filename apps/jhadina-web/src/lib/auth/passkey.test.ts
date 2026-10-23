import { describe, expect, it, vi } from "vitest";
import { passkeyErrorMessage, passkeyDiagnosticCode, performPasskey, safeAuthNext } from "./passkey";

type Auth = Parameters<typeof performPasskey>[0];
const owner = { id: "owner", email: "dorianmorris8@icloud.com", email_confirmed_at: "2026-10-20T10:00:00Z", is_anonymous: false };
function client() {
  return {
    getUser: vi.fn().mockResolvedValue({ data: { user: owner }, error: null }),
    registerPasskey: vi.fn().mockResolvedValue({ data: { id: "credential" }, error: null }),
    signInWithPasskey: vi.fn().mockResolvedValue({ data: { user: owner, session: { user: owner } }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
}

describe("passkey authentication boundary", () => {
  it("accepts a session issued by the auth provider", async () => {
    const auth = client();
    await expect(performPasskey(auth as unknown as Auth, "signin")).resolves.toBeUndefined();
    expect(auth.registerPasskey).not.toHaveBeenCalled();
  });
  it("rejects provider errors, missing sessions and mismatched identities", async () => {
    const auth = client();
    const error = { code: "passkey_disabled" };
    auth.signInWithPasskey.mockResolvedValueOnce({ data: null, error });
    await expect(performPasskey(auth as unknown as Auth, "signin")).rejects.toBe(error);
    for (const data of [{ user: { id: "owner" }, session: null }, { user: { id: "owner" }, session: { user: { id: "other" } } }]) {
      auth.signInWithPasskey.mockResolvedValueOnce({ data, error: null });
      await expect(performPasskey(auth as unknown as Auth, "signin")).rejects.toThrow("PASSKEY_SESSION_UNVERIFIED");
    }
  });
  it("requires verified non-anonymous identity before enrollment", async () => {
    const auth = client();
    for (const result of [{ data: { user: null }, error: null }, { data: { user: { id: "owner", is_anonymous: true } }, error: null }, { data: { user: { id: "owner" } }, error: new Error("expired") }]) {
      auth.getUser.mockResolvedValueOnce(result);
      await expect(performPasskey(auth as unknown as Auth, "register")).rejects.toThrow("PASSKEY_SIGN_IN_REQUIRED");
    }
    expect(auth.registerPasskey).not.toHaveBeenCalled();
  });
  it("does not claim enrollment without a verified credential ID", async () => {
    const auth = client();
    auth.registerPasskey.mockResolvedValueOnce({ data: null, error: null });
    await expect(performPasskey(auth as unknown as Auth, "register")).rejects.toThrow("PASSKEY_REGISTRATION_UNVERIFIED");
    await expect(performPasskey(auth as unknown as Auth, "register")).resolves.toBeUndefined();
  });
  it("denies and signs out a non-owner or unconfirmed passkey identity", async () => {
    const auth = client();
    for (const user of [
      { ...owner, email: "director-certification@system.jhadina.test" },
      { ...owner, email_confirmed_at: null },
    ]) {
      auth.signInWithPasskey.mockResolvedValueOnce({ data: { user, session: { user } }, error: null });
      await expect(performPasskey(auth as unknown as Auth, "signin")).rejects.toThrow("PASSKEY_OWNER_REQUIRED");
    }
    expect(auth.signOut).toHaveBeenCalledTimes(2);
  });
  it("keeps redirects on site including backslash and control-character attacks", () => {
    for (const value of [null, "https://evil.test", "//evil.test", "/\\evil.test", "/\nevil.test"]) expect(safeAuthNext(value)).toBe("/");
    expect(safeAuthNext("/ask-jhadina?session=one")).toBe("/ask-jhadina?session=one");
  });
  it("distinguishes RP ID mismatch, expired challenges and failed Supabase verification without leaking provider messages", () => {
    expect(passkeyErrorMessage({ code: "ERROR_INVALID_RP_ID", message: "secret credential bytes" })).toContain("website address");
    expect(passkeyErrorMessage({ code: "ERROR_INVALID_DOMAIN" })).toContain("website address");
    expect(passkeyErrorMessage({ code: "webauthn_verification_failed" })).toContain("owner email link");
    expect(passkeyErrorMessage({ code: "webauthn_challenge_not_found" })).toContain("expired");
    expect(passkeyErrorMessage({ code: "webauthn_credential_not_found" })).toContain("not registered");
    expect(passkeyErrorMessage(new Error("PASSKEY_SESSION_UNVERIFIED"))).toContain("owner session");
    expect(passkeyDiagnosticCode({ code: "webauthn_verification_failed" })).toBe("webauthn_verification_failed");
    expect(passkeyDiagnosticCode({ code: "secret-key-do-not-show" })).toBe("passkey_unknown_error");
    expect(passkeyDiagnosticCode(new Error("auth provider secret payload"))).toBe("passkey_unknown_error");
    expect(passkeyErrorMessage(new Error("auth provider secret payload"))).not.toContain("secret payload");
  });
  it("fails safely if experimental passkey API is absent instead of displaying an unhandled error", async () => {
    const auth = client();
    (auth as unknown as {signInWithPasskey: unknown}).signInWithPasskey = undefined;
    await expect(performPasskey(auth as unknown as Auth, "signin")).rejects.toThrow("PASSKEY_METHOD_UNAVAILABLE");
    expect(auth.signOut).not.toHaveBeenCalled();
  });
  it("shows useful cancellation/configuration errors without echoing provider details", () => {
    expect(passkeyErrorMessage({ code: "passkey_disabled" })).toContain("not enabled");
    expect(passkeyErrorMessage({ name: "NotAllowedError" })).toContain("cancelled");
    expect(passkeyErrorMessage(new Error("sensitive internal detail"))).not.toContain("sensitive");
  });
});

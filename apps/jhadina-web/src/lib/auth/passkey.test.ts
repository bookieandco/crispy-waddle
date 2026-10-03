import { describe, expect, it, vi } from "vitest";
import { passkeyErrorMessage, performPasskey, safeAuthNext } from "./passkey";

type Auth = Parameters<typeof performPasskey>[0];
function client() {
  return {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner" } }, error: null }),
    registerPasskey: vi.fn().mockResolvedValue({ data: { id: "credential" }, error: null }),
    signInWithPasskey: vi.fn().mockResolvedValue({ data: { user: { id: "owner" }, session: { user: { id: "owner" } } }, error: null }),
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
  it("keeps redirects on site including backslash and control-character attacks", () => {
    for (const value of [null, "https://evil.test", "//evil.test", "/\\evil.test", "/\nevil.test"]) expect(safeAuthNext(value)).toBe("/");
    expect(safeAuthNext("/ask-jhadina?session=one")).toBe("/ask-jhadina?session=one");
  });
  it("shows useful cancellation/configuration errors without echoing provider details", () => {
    expect(passkeyErrorMessage({ code: "passkey_disabled" })).toContain("not enabled");
    expect(passkeyErrorMessage({ name: "NotAllowedError" })).toContain("cancelled");
    expect(passkeyErrorMessage(new Error("sensitive internal detail"))).not.toContain("sensitive");
  });
});

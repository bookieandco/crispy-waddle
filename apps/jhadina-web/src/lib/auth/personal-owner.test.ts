import { describe, expect, it } from "vitest";
import { isPersonalOwnerEmail, isVerifiedPersonalOwner } from "./personal-owner";

const owner = {
  id: "verified-user-uuid",
  email: "dorianmorris8@icloud.com",
  email_confirmed_at: "2026-10-20T00:00:00Z",
  is_anonymous: false,
} as const;

describe("single personal Jhadina owner admission", () => {
  it("accepts only the exact requested email, case-insensitively", () => {
    expect(isPersonalOwnerEmail(owner.email)).toBe(true);
    expect(isPersonalOwnerEmail(" DORIANMORRIS8@ICLOUD.COM ")).toBe(true);
    for (const email of [
      "director-certification@system.jhadina.test",
      "dorianmorris8@icloud.com.evil.test",
      "dorianmorris8+other@icloud.com",
      "not-dorianmorris8@icloud.com",
      null,
    ]) expect(isPersonalOwnerEmail(email)).toBe(false);
  });
  it("requires provider confirmation, stable id and non-anonymous user", () => {
    expect(isVerifiedPersonalOwner(owner)).toBe(true);
    expect(isVerifiedPersonalOwner({ ...owner, email_confirmed_at: undefined })).toBe(false);
    expect(isVerifiedPersonalOwner({ ...owner, id: "" })).toBe(false);
    expect(isVerifiedPersonalOwner({ ...owner, is_anonymous: true })).toBe(false);
    expect(isVerifiedPersonalOwner({ ...owner, email: "director-certification@system.jhadina.test" })).toBe(false);
    expect(isVerifiedPersonalOwner(null)).toBe(false);
  });
});

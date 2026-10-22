import { describe, expect, it } from "vitest";
import { validRecoveryEmail, validateNewPassword } from "./password-recovery";

describe("verified owner password setup / recovery", () => {
  it("accepts a valid recovery email but rejects malformed and oversized input", () => {
    expect(validRecoveryEmail("  owner@example.com ")).toBe("owner@example.com");
    for (const value of ["", "no-at-sign", "bad@example", "a".repeat(255) + "@example.com", null, {}]) {
      expect(validRecoveryEmail(value)).toBeNull();
    }
  });
  it("does not accept short, mismatched, nonstring or enormous passwords", () => {
    expect(validateNewPassword("owner-password-123", "owner-password-123")).toBeNull();
    expect(validateNewPassword("short", "short")).toBe("password_requirements");
    expect(validateNewPassword("abcdefgh", "abcdefgh1")).toBe("password_mismatch");
    expect(validateNewPassword("a".repeat(129), "a".repeat(129))).toBe("password_requirements");
    expect(validateNewPassword(null, null)).toBe("password_requirements");
  });
});

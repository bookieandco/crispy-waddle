import { describe, it, expect } from "vitest"
import { redactSecrets } from "./redact"

describe("redactSecrets", () => {
  it("redacts a Stripe-style secret key", () => {
    const { redacted, redactionCount } = redactSecrets("my key is sk_test_51Abc123Def456Ghi789 keep it safe")
    expect(redacted).not.toContain("sk_test_51Abc123Def456Ghi789")
    expect(redacted).toContain("[REDACTED]")
    expect(redactionCount).toBe(1)
  })

  it("redacts a Bearer authorization header", () => {
    const { redacted, redactionCount } = redactSecrets("Authorization: Bearer abc123.def456-ghi")
    expect(redacted).not.toContain("abc123.def456-ghi")
    expect(redactionCount).toBe(1)
  })

  it("redacts a generic key: value secret pattern", () => {
    const { redacted, redactionCount } = redactSecrets("api_key: sk_live_reallysecretvalue123")
    expect(redacted).toContain("[REDACTED]")
    expect(redactionCount).toBeGreaterThanOrEqual(1)
  })

  it("leaves ordinary text completely untouched", () => {
    const { redacted, redactionCount } = redactSecrets("I prefer cinematic visuals and warm color grading")
    expect(redacted).toBe("I prefer cinematic visuals and warm color grading")
    expect(redactionCount).toBe(0)
  })

  it("redacts multiple distinct secrets in the same text", () => {
    const { redactionCount } = redactSecrets("sk_test_aaaaaaaaaaaaaaaa and Bearer bbbbbbbbbbbbbbbb")
    expect(redactionCount).toBe(2)
  })
})

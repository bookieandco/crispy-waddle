import { describe, test, expect } from "vitest"
import {
  EnvironmentSandboxCredentialResolver,
  sandboxCredentialRefToEnvKey,
  assertStripeSandboxKey,
} from "./sandbox-credential"

describe("Commerce sandbox credential resolution — sandbox keys only, resolved server-side", () => {
  test("resolves a valid ref to its env key", () => {
    expect(sandboxCredentialRefToEnvKey("commerce/stripe/sandbox")).toBe("JHADINA_SECRET_STRIPE_SANDBOX")
  })

  test("rejects a malformed ref before ever touching env", () => {
    expect(() => sandboxCredentialRefToEnvKey("not-a-valid-ref")).toThrow("INVALID_CREDENTIAL_REF")
  })

  test("a resolver with a real sk_test_ key resolves successfully", async () => {
    const resolver = new EnvironmentSandboxCredentialResolver({ JHADINA_SECRET_STRIPE_SANDBOX: "sk_test_abc123" } as unknown as NodeJS.ProcessEnv)
    const resolved = await resolver.resolve("commerce/stripe/sandbox")
    expect(resolved.secret).toBe("sk_test_abc123")
  })

  test("a missing credential fails closed before any provider is constructed", async () => {
    const resolver = new EnvironmentSandboxCredentialResolver({} as unknown as NodeJS.ProcessEnv)
    await expect(resolver.resolve("commerce/stripe/sandbox")).rejects.toThrow("CREDENTIAL_NOT_CONFIGURED")
  })

  test("a live-mode key is rejected even if it's exactly what's configured — no production credentials, ever", async () => {
    const resolver = new EnvironmentSandboxCredentialResolver({ JHADINA_SECRET_STRIPE_SANDBOX: "sk_live_do_not_use" } as unknown as NodeJS.ProcessEnv)
    await expect(resolver.resolve("commerce/stripe/sandbox")).rejects.toThrow("SANDBOX_CREDENTIAL_MUST_BE_TEST_MODE")
  })

  test("assertStripeSandboxKey is the same guard the resolver uses, independently callable and independently correct", () => {
    expect(() => assertStripeSandboxKey("sk_test_x", "commerce/stripe/sandbox")).not.toThrow()
    expect(() => assertStripeSandboxKey("sk_live_x", "commerce/stripe/sandbox")).toThrow("SANDBOX_CREDENTIAL_MUST_BE_TEST_MODE")
    expect(() => assertStripeSandboxKey("garbage", "commerce/stripe/sandbox")).toThrow("SANDBOX_CREDENTIAL_MUST_BE_TEST_MODE")
  })
})

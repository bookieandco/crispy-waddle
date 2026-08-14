import { describe, test, expect, vi, afterEach } from "vitest"
import { EnvironmentSandboxCredentialResolver } from "./sandbox-credential"
import { createStripeSandboxProductionProvider, STRIPE_SANDBOX_CREDENTIAL_REF } from "./production-payment-provider"

/**
 * PL-6: proves the real credential-resolution boundary is actually
 * wired — not merely that the underlying resolver/provider classes
 * work in isolation (sandbox-credential.test.ts and
 * stripe-sandbox-provider.test.ts already prove that).
 *
 * The third test spies on the real global fetch rather than injecting
 * a fake transport, specifically to prove the *default*,
 * no-overrides path — the one real composition code would take —
 * reaches the actual global fetch, not a silently-substituted fake.
 * Nothing in this file makes a real network call: fetch is always
 * mocked before use.
 */

afterEach(() => {
  vi.restoreAllMocks()
})

describe("Commerce production payment provider — PL-6 credential-resolution boundary", () => {
  test("fails closed before any transport exists when no credential is configured", async () => {
    const credentialResolver = new EnvironmentSandboxCredentialResolver({} as unknown as NodeJS.ProcessEnv)
    await expect(createStripeSandboxProductionProvider({ credentialResolver })).rejects.toThrow("CREDENTIAL_NOT_CONFIGURED")
  })

  test("fails closed on a live-mode key, even if that's exactly what's configured", async () => {
    const credentialResolver = new EnvironmentSandboxCredentialResolver({
      JHADINA_SECRET_STRIPE_SANDBOX: "sk_live_do_not_use",
    } as unknown as NodeJS.ProcessEnv)
    await expect(createStripeSandboxProductionProvider({ credentialResolver })).rejects.toThrow("SANDBOX_CREDENTIAL_MUST_BE_TEST_MODE")
  })

  test("with no fetchImpl override (the real composition path), the resolved credential reaches the real global fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "pi_prod_1", status: "succeeded", amount: 0, currency: "usd" }), { status: 200 }),
    )
    const credentialResolver = new EnvironmentSandboxCredentialResolver({
      JHADINA_SECRET_STRIPE_SANDBOX: "sk_test_production_wiring_proof",
    } as unknown as NodeJS.ProcessEnv)

    // No fetchImpl passed — this is the path real composition code takes.
    const provider = await createStripeSandboxProductionProvider({ credentialResolver })
    await provider.createPaymentIntent({
      paymentId: "pay_prod_1",
      orderId: "order_prod_1",
      customer: { id: "cust_1", type: "customer" },
      seller: { id: "platform", type: "platform" },
      amount: { amountMinor: 1000, currency: "USD" },
      lines: [],
      taxes: [],
      platformFees: [],
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toContain("api.stripe.com/v1/payment_intents")
    expect((init?.headers as Record<string, string>).authorization).toBe("Bearer sk_test_production_wiring_proof")
  })

  test("defaults to the documented commerce/stripe/sandbox credential ref", async () => {
    const resolveSpy = vi.fn().mockResolvedValue({ secret: "sk_test_default_ref_proof" })
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "pi_1", status: "succeeded", amount: 0, currency: "usd" }), { status: 200 }),
    )

    await createStripeSandboxProductionProvider({ credentialResolver: { resolve: resolveSpy } })
    expect(resolveSpy).toHaveBeenCalledWith(STRIPE_SANDBOX_CREDENTIAL_REF)
    void fetchSpy
  })
})

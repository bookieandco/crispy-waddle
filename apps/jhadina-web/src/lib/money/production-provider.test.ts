import { describe, test, expect, vi, afterEach } from "vitest"
import { EnvironmentCredentialResolver } from "@jhadina/money-core"
import { createMoneyPlaidProductionRegistry, PLAID_PROVIDER } from "./production-provider"

/**
 * PL-8: proves the real Plaid credential-resolution and
 * sandbox-boundary wiring is actually connected — not merely that the
 * underlying money-core pieces work in isolation (money-core's own
 * plaid-provider-registration.test.ts already proves that).
 *
 * The third test spies on the real global fetch rather than injecting
 * a fake transport, specifically to prove the *default*, no-overrides
 * path — the one real composition code would take — reaches the
 * actual global fetch, not a silently-substituted fake. Nothing in
 * this file makes a real network call: fetch is always mocked before
 * use.
 */

afterEach(() => {
  vi.restoreAllMocks()
})

describe("Money production Plaid provider — PL-8 credential-resolution and sandbox-boundary wiring", () => {
  test("fails closed before any adapter exists when no credential is configured", async () => {
    const credentialResolver = new EnvironmentCredentialResolver({} as unknown as NodeJS.ProcessEnv)
    await expect(createMoneyPlaidProductionRegistry({ credentialResolver })).rejects.toThrow("CREDENTIAL_NOT_CONFIGURED")
  })

  test("fails closed on a non-sandbox base URL, even with a well-formed credential", async () => {
    const credentialResolver = new EnvironmentCredentialResolver({
      JHADINA_SECRET_PLAID_DEFAULT: JSON.stringify({ clientId: "c", secret: "s", accessToken: "a" }),
    } as unknown as NodeJS.ProcessEnv)
    await expect(
      createMoneyPlaidProductionRegistry({ credentialResolver, baseUrl: "https://production.plaid.com" }),
    ).rejects.toThrow("PLAID_BASE_URL_MUST_BE_SANDBOX")
  })

  test("with no overrides (the real composition path), the resolved credential reaches the real global fetch against the sandbox host", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ accounts: [] }), { status: 200 }),
    )
    const credentialResolver = new EnvironmentCredentialResolver({
      JHADINA_SECRET_PLAID_DEFAULT: JSON.stringify({
        clientId: "prod-wiring-client",
        secret: "prod-wiring-secret",
        accessToken: "prod-wiring-token",
      }),
    } as unknown as NodeJS.ProcessEnv)

    // No baseUrl override passed — this is the path real composition code takes.
    const { registry } = await createMoneyPlaidProductionRegistry({ credentialResolver })
    const adapter = registry.get(PLAID_PROVIDER)
    await adapter.listAccounts({ userId: "u1", capability: "money.account.read", requestId: "r1" })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toBe("https://sandbox.plaid.com/accounts/get")
    expect((init?.headers as Record<string, string>)["PLAID-CLIENT-ID"]).toBe("prod-wiring-client")
    expect((init?.headers as Record<string, string>)["PLAID-SECRET"]).toBe("prod-wiring-secret")
  })

  test("defaults to the documented money/plaid/default credential ref", async () => {
    const resolveSpy = vi.fn().mockResolvedValue({ secret: JSON.stringify({ clientId: "c", secret: "s", accessToken: "a" }) })
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ accounts: [] }), { status: 200 }),
    )

    await createMoneyPlaidProductionRegistry({ credentialResolver: { resolve: resolveSpy } })
    expect(resolveSpy).toHaveBeenCalledWith("money/plaid/default")
    void fetchSpy
  })

  test("the registry exposes exactly one provider, and it has no mutation capability", async () => {
    const credentialResolver = new EnvironmentCredentialResolver({
      JHADINA_SECRET_PLAID_DEFAULT: JSON.stringify({ clientId: "c", secret: "s", accessToken: "a" }),
    } as unknown as NodeJS.ProcessEnv)
    const { registry, providerConfig } = await createMoneyPlaidProductionRegistry({ credentialResolver })

    expect(registry.list()).toEqual([PLAID_PROVIDER])
    expect(providerConfig[PLAID_PROVIDER].capabilities).toEqual(["money.account.read"])

    const adapter = registry.get(PLAID_PROVIDER)
    expect((adapter as unknown as Record<string, unknown>).createPayment).toBeUndefined()
    expect((adapter as unknown as Record<string, unknown>).createTransfer).toBeUndefined()
  })
})

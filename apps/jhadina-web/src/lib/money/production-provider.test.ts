import { describe, test, expect, vi, afterEach } from "vitest"
import { EnvironmentCredentialResolver } from "@jhadina/money-core"
import { createMoneyPlaidProductionRegistry, PLAID_PROVIDER } from "./production-provider"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("Money production Plaid provider — broker-only credential wiring", () => {
  test("fails closed when the production composition root does not supply a broker-backed resolver", async () => {
    await expect(createMoneyPlaidProductionRegistry()).rejects.toThrow("CREDENTIAL_BROKER_REQUIRED")
  })

  test("test-only resolver still fails closed before any adapter exists when no credential is configured", async () => {
    const credentialResolver = new EnvironmentCredentialResolver({} as unknown as NodeJS.ProcessEnv)
    await expect(createMoneyPlaidProductionRegistry({ credentialResolver })).rejects.toThrow("CREDENTIAL_NOT_CONFIGURED")
  })

  test("fails closed on a non-sandbox base URL, even with a well-formed test resolver", async () => {
    const credentialResolver = new EnvironmentCredentialResolver({
      JHADINA_SECRET_PLAID_DEFAULT: JSON.stringify({ clientId: "c", secret: "s", accessToken: "a" }),
    } as unknown as NodeJS.ProcessEnv)
    await expect(
      createMoneyPlaidProductionRegistry({ credentialResolver, baseUrl: "https://production.plaid.com" }),
    ).rejects.toThrow("PLAID_BASE_URL_MUST_BE_SANDBOX")
  })

  test("a broker-compatible resolver is the only way the provider factory receives the documented credential ref", async () => {
    const resolveSpy = vi.fn().mockResolvedValue({
      secret: JSON.stringify({ clientId: "c", secret: "s", accessToken: "a" }),
    })
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ accounts: [] }), { status: 200 }),
    )

    await createMoneyPlaidProductionRegistry({ credentialResolver: { resolve: resolveSpy } })
    expect(resolveSpy).toHaveBeenCalledWith("money/plaid/default")
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

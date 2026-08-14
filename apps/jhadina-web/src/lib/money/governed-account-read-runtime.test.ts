import { describe, it, expect } from "vitest"
import { MoneyProviderRegistry, type ProviderConfig } from "@jhadina/money-core"
import type { ActionRequestIdentity, JhadinaActionRequest, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createReferenceBankAdapter, createInMemoryAuditRpcClient, type RecordedReferenceRequest } from "./reference-adapters"
import { PLAID_PROVIDER, type MoneyPlaidProductionRegistry } from "./production-provider"
import { runGovernedMoneyAccountRead, type GovernedMoneyRuntimeOverrides } from "./governed-account-read-runtime"

/**
 * PL-8 (Jhadina OS Integration Phase 2, Money real-integration Phase 1).
 *
 * These tests exercise the real production composition root
 * (runGovernedMoneyAccountRead) against a fake AuditRpcClient and a fake
 * provider registry — the same reference bank adapter SP-3's
 * governed-account-read.test.ts already validated, registered here under
 * the real 'plaid' provider name instead of 'reference-bank'.
 * createRequestIdentityVerifier() and the real Plaid credential path
 * have no meaning in a test process, so both are overridden; production
 * always uses the real ones (production-provider.test.ts proves that
 * wiring separately, with a mocked global fetch).
 */
function staticIdentityVerifier(identity: ActionRequestIdentity): JhadinaIdentityVerifier {
  return {
    async verify(request: JhadinaActionRequest) {
      if (request.userId !== identity.userId) {
        throw new Error("Action identity mismatch")
      }
      return identity
    },
  }
}

function fakeProviders(recordedRequests: RecordedReferenceRequest[] = []): MoneyPlaidProductionRegistry {
  const registry = new MoneyProviderRegistry()
  registry.register(
    createReferenceBankAdapter({ provider: PLAID_PROVIDER, secret: "fake-plaid-secret", recordedRequests }),
  )
  const providerConfig: Readonly<Record<string, ProviderConfig>> = {
    [PLAID_PROVIDER]: { enabled: true, credentialRef: "money/plaid/default", capabilities: ["money.account.read"] },
  }
  return { registry, providerConfig }
}

describe("Money product loop — UI-facing composition root (Jhadina OS Integration Phase 2, PL-8)", () => {
  it("an authorized read succeeds, calls the provider exactly once, and is recorded in the durable ledger", async () => {
    const identity: ActionRequestIdentity = { userId: "user-money-loop-1", sessionId: "session-money-loop-1" }
    const supabase = createInMemoryAuditRpcClient()
    const recordedRequests: RecordedReferenceRequest[] = []
    const overrides: GovernedMoneyRuntimeOverrides = {
      identityVerifier: staticIdentityVerifier(identity),
      supabase,
      providers: fakeProviders(recordedRequests),
    }

    const result = await runGovernedMoneyAccountRead(identity.userId, "req-money-1", overrides)

    expect(result.verifiedUserId).toBe(identity.userId)
    expect(result.accounts.length).toBeGreaterThan(0)
    expect(result.accounts[0].provider).toBe(PLAID_PROVIDER)

    // The real production ledger path fired: started, then completed.
    const statuses = supabase.calls.map((call) => call.args.p_status)
    expect(statuses).toEqual(["started", "completed"])
    expect(supabase.calls.every((call) => call.args.p_capability === "money.account.read")).toBe(true)

    // The provider was actually called once, carrying the resolved credential.
    expect(recordedRequests).toHaveLength(1)
    expect(recordedRequests[0].authorization).toContain("Bearer ")
  })

  it("an unauthorized (identity-mismatched) read fails closed before anything is recorded or the provider is called", async () => {
    const identity: ActionRequestIdentity = { userId: "user-money-loop-2", sessionId: "session-money-loop-2" }
    const supabase = createInMemoryAuditRpcClient()
    const recordedRequests: RecordedReferenceRequest[] = []
    const overrides: GovernedMoneyRuntimeOverrides = {
      identityVerifier: staticIdentityVerifier(identity),
      supabase,
      providers: fakeProviders(recordedRequests),
    }

    await expect(
      runGovernedMoneyAccountRead("someone-else", "req-money-2", overrides),
    ).rejects.toThrow("Action identity mismatch")

    // Identity verification happens before the executor's own started-audit
    // append — there is nothing durable to audit against an identity that
    // was never verified (same property SP-3's reference proof found).
    expect(supabase.calls).toHaveLength(0)
    expect(recordedRequests).toHaveLength(0)
  })

  it("the resolved credential never reaches the consumer/UI layer", async () => {
    const identity: ActionRequestIdentity = { userId: "user-money-loop-3", sessionId: "session-money-loop-3" }
    const supabase = createInMemoryAuditRpcClient()
    const overrides: GovernedMoneyRuntimeOverrides = {
      identityVerifier: staticIdentityVerifier(identity),
      supabase,
      providers: fakeProviders(),
    }

    const result = await runGovernedMoneyAccountRead(identity.userId, "req-money-3", overrides)

    const secretNeedle = "fake-plaid-secret"
    expect(JSON.stringify(result.accounts)).not.toContain(secretNeedle)
    expect(JSON.stringify(supabase.calls)).not.toContain(secretNeedle)
  })

  it("no mutation capability exists on this path — the registered adapter is structurally read-only", () => {
    const providers = fakeProviders()
    const adapter = providers.registry.get(PLAID_PROVIDER)
    expect((adapter as unknown as Record<string, unknown>).createPayment).toBeUndefined()
    expect((adapter as unknown as Record<string, unknown>).createTransfer).toBeUndefined()
  })
})

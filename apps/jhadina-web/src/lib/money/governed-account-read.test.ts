import { describe, it, expect } from "vitest"
import { StaticIdentityVerifier, type ActionIdentityVerifier, type ActionRequest } from "@jhadina/action-core"
import { MoneyCapabilityPolicy } from "@jhadina/money-core"
import {
  createReferenceMoneyAccountReadExecutor,
  REFERENCE_MONEY_PROVIDER,
} from "./governed-account-read"
import {
  createInMemoryAuditRpcClient,
  createReferenceBankAdapter,
  createWorkspaceEntitlementChecker,
  DEFAULT_REFERENCE_FIXTURE,
  type RecordedReferenceRequest,
} from "./reference-adapters"

const USER = "user-money-1"
const SESSION = "session-money-1"

function readRequest(userId: string, id = "req-1"): ActionRequest<{ capability: "money.account.read"; provider: string }> {
  return {
    id,
    userId,
    type: "money.account.read",
    requestedAt: new Date().toISOString(),
    action: { capability: "money.account.read", provider: REFERENCE_MONEY_PROVIDER },
  }
}

/** An identity verifier that never resolves any identity — a stand-in for an unauthenticated caller. */
const rejectingIdentityVerifier: ActionIdentityVerifier = {
  async verify() {
    throw new Error("NO_SESSION")
  },
}

describe("Money account read — governed lifecycle (Jhadina OS Integration Phase 1, Proof #3)", () => {
  it("1. an authorized read succeeds and returns real mapped account data", async () => {
    const supabase = createInMemoryAuditRpcClient()
    const recordedRequests: RecordedReferenceRequest[] = []
    const executor = await createReferenceMoneyAccountReadExecutor({
      identityVerifier: new StaticIdentityVerifier({ userId: USER, sessionId: SESSION }),
      supabase,
      assertUserWorkspace: createWorkspaceEntitlementChecker([USER]),
      recordedRequests,
    })

    const accounts = await executor.execute(readRequest(USER))

    expect(accounts).toHaveLength(DEFAULT_REFERENCE_FIXTURE.accounts.length)
    expect(accounts[0].provider).toBe(REFERENCE_MONEY_PROVIDER)
    expect(accounts[0].maskedName).toContain("••••4321")

    // The real production ledger path fired: started, then completed.
    const statuses = supabase.calls.map((call) => call.args.p_status)
    expect(statuses).toEqual(["started", "completed"])
    expect(supabase.calls.every((call) => call.args.p_capability === "money.account.read")).toBe(true)

    // The provider was actually called once, carrying the resolved credential.
    expect(recordedRequests).toHaveLength(1)
    expect(recordedRequests[0].authorization).toContain("Bearer ")
  })

  it("2a. a wrong identity fails closed before anything is recorded or the provider is called", async () => {
    const supabase = createInMemoryAuditRpcClient()
    const recordedRequests: RecordedReferenceRequest[] = []
    const executor = await createReferenceMoneyAccountReadExecutor({
      identityVerifier: new StaticIdentityVerifier({ userId: USER, sessionId: SESSION }),
      supabase,
      assertUserWorkspace: createWorkspaceEntitlementChecker([USER]),
      recordedRequests,
    })

    await expect(executor.execute(readRequest("someone-else"))).rejects.toThrow("Action identity mismatch")

    // Identity verification happens before the executor's own started-audit
    // append (VerifiedActionExecutor checks identity, then delegates) — a
    // real architectural property of the existing production composition,
    // not something this proof adds: there is nothing durable to audit
    // against an identity that was never verified.
    expect(supabase.calls).toHaveLength(0)
    expect(recordedRequests).toHaveLength(0)
  })

  it("2b. a missing/unverifiable identity fails closed the same way", async () => {
    const supabase = createInMemoryAuditRpcClient()
    const recordedRequests: RecordedReferenceRequest[] = []
    const executor = await createReferenceMoneyAccountReadExecutor({
      identityVerifier: rejectingIdentityVerifier,
      supabase,
      recordedRequests,
    })

    await expect(executor.execute(readRequest(USER))).rejects.toThrow("NO_SESSION")
    expect(supabase.calls).toHaveLength(0)
    expect(recordedRequests).toHaveLength(0)
  })

  it("3. missing the money.account.read capability in the security policy denies the request before the provider is called", async () => {
    const supabase = createInMemoryAuditRpcClient()
    const recordedRequests: RecordedReferenceRequest[] = []
    // Same identity, same workspace entitlement, same provider config — the
    // only variable is that this provider config omits the capability from
    // its own allow-list, which the health gate enforces before dispatch.
    const executor = await createReferenceMoneyAccountReadExecutor({
      identityVerifier: new StaticIdentityVerifier({ userId: USER, sessionId: SESSION }),
      supabase,
      assertUserWorkspace: createWorkspaceEntitlementChecker([USER]),
      recordedRequests,
      omitCapabilityFromConfig: true,
    })

    await expect(executor.execute(readRequest(USER))).rejects.toThrow(/BANK_PROVIDER_NOT_READY/)
    expect(recordedRequests).toHaveLength(0)

    // money-core also ships a second, independent ActionPolicy for money
    // actions (MoneyCapabilityPolicy) that isn't the one wired into the
    // production account-read composition above (that uses
    // SecurityCoreActionPolicy over MONEY_CORE_SECURITY_POLICY instead —
    // see governed-account-read.ts in money-core). It agrees on the same
    // outcome for an unrecognized capability, confirming the two policies
    // aren't in conflict, but this is a real duplication worth flagging in
    // the checkpoint rather than silently treating as equivalent.
    const policy = new MoneyCapabilityPolicy()
    await expect(
      policy.evaluate({
        id: "policy-check",
        userId: USER,
        type: "money.account.read",
        requestedAt: new Date().toISOString(),
        action: { capability: "money.does.not.exist" as never },
      }),
    ).resolves.toBe("deny")
  })

  it("4. unauthorized account access (no workspace entitlement) fails closed before the provider is called", async () => {
    const supabase = createInMemoryAuditRpcClient()
    const recordedRequests: RecordedReferenceRequest[] = []
    const executor = await createReferenceMoneyAccountReadExecutor({
      identityVerifier: new StaticIdentityVerifier({ userId: USER, sessionId: SESSION }),
      supabase,
      assertUserWorkspace: createWorkspaceEntitlementChecker(["someone-with-access"]),
      recordedRequests,
    })

    await expect(executor.execute(readRequest(USER))).rejects.toThrow("MONEY_WORKSPACE_UNAUTHORIZED")

    // Policy allowed it (the capability itself is fine) and the executor
    // recorded the attempt as started, but the handler's own workspace
    // check stopped it before the provider was ever reached — a real
    // fail-closed boundary, not a mocked return value.
    const statuses = supabase.calls.map((call) => call.args.p_status)
    expect(statuses).toEqual(["started", "failed"])
    expect(recordedRequests).toHaveLength(0)
  })

  it("5. a provider failure fails cleanly and is recorded as failed, not silently swallowed", async () => {
    const supabase = createInMemoryAuditRpcClient()
    const recordedRequests: RecordedReferenceRequest[] = []
    const executor = await createReferenceMoneyAccountReadExecutor({
      identityVerifier: new StaticIdentityVerifier({ userId: USER, sessionId: SESSION }),
      supabase,
      assertUserWorkspace: createWorkspaceEntitlementChecker([USER]),
      recordedRequests,
      failureMode: "http-error",
    })

    await expect(executor.execute(readRequest(USER))).rejects.toThrow(/PROVIDER_HTTP_ERROR/)

    const statuses = supabase.calls.map((call) => call.args.p_status)
    expect(statuses).toEqual(["started", "failed"])
    // The provider was actually reached this time (the failure is the
    // provider's response, not us never calling it).
    expect(recordedRequests).toHaveLength(1)
  })

  it("5b. an unresolvable credential fails closed before any provider construction or call", async () => {
    await expect(
      createReferenceMoneyAccountReadExecutor({
        identityVerifier: new StaticIdentityVerifier({ userId: USER, sessionId: SESSION }),
        supabase: createInMemoryAuditRpcClient(),
        omitCredential: true,
      }),
    ).rejects.toThrow(/CREDENTIAL_NOT_CONFIGURED/)
  })

  it("6. the resolved credential never reaches the consumer/UI layer", async () => {
    const supabase = createInMemoryAuditRpcClient()
    const recordedRequests: RecordedReferenceRequest[] = []
    const executor = await createReferenceMoneyAccountReadExecutor({
      identityVerifier: new StaticIdentityVerifier({ userId: USER, sessionId: SESSION }),
      supabase,
      assertUserWorkspace: createWorkspaceEntitlementChecker([USER]),
      recordedRequests,
    })

    const accounts = await executor.execute(readRequest(USER))

    // The credential DID reach the provider boundary (proven by the
    // Authorization header captured in test 1) but must not appear
    // anywhere in what comes back to the caller, nor in anything durably
    // audited.
    const secretNeedle = "ref-secret-do-not-log-9f2c"
    expect(JSON.stringify(accounts)).not.toContain(secretNeedle)
    expect(JSON.stringify(supabase.calls)).not.toContain(secretNeedle)
    // The consumer-facing account shape has no field capable of carrying it.
    for (const account of accounts) {
      expect(Object.keys(account).sort()).toEqual(
        ["currency", "externalId", "id", "maskedName", "provider", "type"].sort(),
      )
    }
  })

  it("7. no mutation capability exists on the read-only path", async () => {
    // Structural: the reference adapter this proof composes (like
    // PlaidReadOnlyAdapter itself) simply has no createPayment/
    // createTransfer methods — they are optional on BankAdapter and
    // ReadOnlyHttpBankAdapter (the real, already-landed class) never
    // implements them, so mutation is structurally absent from this
    // provider, not just policy-blocked.
    const adapter = createReferenceBankAdapter({ provider: REFERENCE_MONEY_PROVIDER, secret: "x" })
    expect((adapter as unknown as Record<string, unknown>).createPayment).toBeUndefined()
    expect((adapter as unknown as Record<string, unknown>).createTransfer).toBeUndefined()

    // Policy-level: the security policy actually wired into money-core's
    // production account-read composition (MONEY_CORE_SECURITY_POLICY =
    // base policy + only money.account.read, from governed-account-read.ts)
    // never allow-lists any financial-mutation capability.
    const { MONEY_CORE_SECURITY_POLICY } = await import("@jhadina/money-core")
    for (const mutationCapability of ["money.payment.create", "money.transfer.create", "money.account.change"]) {
      expect(MONEY_CORE_SECURITY_POLICY.allowedCapabilities).not.toContain(mutationCapability)
    }

    // Attempting to dispatch a mutation-shaped action type through this
    // same executor fails — no handler is registered for it and policy
    // would deny it regardless.
    const executor = await createReferenceMoneyAccountReadExecutor({
      identityVerifier: new StaticIdentityVerifier({ userId: USER, sessionId: SESSION }),
      supabase: createInMemoryAuditRpcClient(),
      assertUserWorkspace: createWorkspaceEntitlementChecker([USER]),
    })
    await expect(
      executor.execute({
        id: "mutation-attempt",
        userId: USER,
        type: "money.payment.create",
        requestedAt: new Date().toISOString(),
        action: { capability: "money.account.read", provider: REFERENCE_MONEY_PROVIDER },
      }),
    ).rejects.toThrow()
  })
})

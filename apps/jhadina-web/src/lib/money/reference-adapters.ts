import { ReadOnlyHttpBankAdapter, type HttpClient, type MoneyAccount } from "@jhadina/money-core"
import type { AuditRpcClient } from "@jhadina/action-core"

/**
 * Spine Proof #3 (Money/Plaid) reference boundary.
 *
 * This deliberately does NOT add a second Plaid client. It reuses the
 * real, already-landed `ReadOnlyHttpBankAdapter` — a provider-neutral,
 * HTTPS-enforced, read-only adapter with no payment/transfer methods —
 * and injects a fake `fetchImpl` that never performs real network I/O.
 * `PlaidReadOnlyAdapter` itself is untouched and remains the eventual
 * production boundary for the real provider.
 */

export type ReferenceBankAccountFixture = {
  id: string
  name: string
  mask: string
  type: string
  currency: string
}

export type ReferenceBankFixture = {
  accounts: ReferenceBankAccountFixture[]
}

export const DEFAULT_REFERENCE_FIXTURE: ReferenceBankFixture = {
  accounts: [
    { id: "acc_ref_checking", name: "Reference Checking", mask: "4321", type: "checking", currency: "USD" },
    { id: "acc_ref_savings", name: "Reference Savings", mask: "9911", type: "savings", currency: "USD" },
  ],
}

export type ReferenceBankFailureMode = "http-error" | "network-error" | "malformed-payload"

export type RecordedReferenceRequest = { url: string; authorization: string | null }

export function mapReferenceAccounts(payload: unknown, provider: string): MoneyAccount[] {
  const body = payload as { accounts?: ReferenceBankAccountFixture[] }
  return (body.accounts ?? []).map((account) => ({
    id: `${provider}:${account.id}`,
    provider,
    externalId: account.id,
    type: account.type,
    currency: account.currency,
    maskedName: `${account.name} ••••${account.mask}`,
  }))
}

/**
 * A fake fetch that never touches the network. Records every request it
 * receives (including the Authorization header carrying the resolved
 * credential) so tests can prove the credential reached the provider
 * boundary and inspect exactly what left this process — without ever
 * calling a real endpoint.
 */
export function createReferenceFetch(options: {
  fixture?: ReferenceBankFixture
  failureMode?: ReferenceBankFailureMode
  recordedRequests?: RecordedReferenceRequest[]
}): HttpClient {
  const fixture = options.fixture ?? DEFAULT_REFERENCE_FIXTURE

  return async (input, init) => {
    const url = typeof input === "string" ? input : input.toString()
    const headers = new Headers(init?.headers)
    options.recordedRequests?.push({ url, authorization: headers.get("authorization") })

    if (options.failureMode === "network-error") {
      throw new Error("REFERENCE_PROVIDER_UNREACHABLE")
    }
    if (options.failureMode === "http-error") {
      return new Response(JSON.stringify({ error: "reference_provider_unavailable" }), { status: 503 })
    }
    if (options.failureMode === "malformed-payload") {
      return new Response("not json", { status: 200 })
    }

    return new Response(JSON.stringify({ accounts: fixture.accounts }), { status: 200 })
  }
}

export function createReferenceBankAdapter(options: {
  provider: string
  secret: string
  fixture?: ReferenceBankFixture
  failureMode?: ReferenceBankFailureMode
  recordedRequests?: RecordedReferenceRequest[]
}): ReadOnlyHttpBankAdapter {
  return new ReadOnlyHttpBankAdapter({
    provider: options.provider,
    baseUrl: "https://reference-bank.internal.test",
    secret: options.secret,
    accountPath: "/accounts",
    mapAccounts: mapReferenceAccounts,
    fetchImpl: createReferenceFetch({
      fixture: options.fixture,
      failureMode: options.failureMode,
      recordedRequests: options.recordedRequests,
    }),
  })
}

/** Reference workspace-entitlement gate: does this identity own this bank connection? */
export function createWorkspaceEntitlementChecker(allowedUserIds: readonly string[]) {
  return async (userId: string) => {
    if (!allowedUserIds.includes(userId)) throw new Error("MONEY_WORKSPACE_UNAUTHORIZED")
  }
}

export type RecordedAuditCall = { fn: string; args: Record<string, unknown> }

/**
 * In-memory stand-in for the Supabase RPC client `SupabaseAuditLedger`
 * (real, already-landed) writes through. No Supabase dependency for this
 * proof; the real durable ledger is a drop-in swap of this one field.
 * Records every call so tests can inspect the actual audit decisions
 * recorded (p_decision/p_status/p_capability), not just whether execute()
 * rejected.
 */
export function createInMemoryAuditRpcClient(): AuditRpcClient & { calls: RecordedAuditCall[] } {
  const calls: RecordedAuditCall[] = []
  return {
    calls,
    async rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args })
      return { data: null, error: null }
    },
  }
}

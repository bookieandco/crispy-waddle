import { describe, it, expect } from "vitest"
import { SupabaseAuditLedger, type AuditRpcClient } from "@jhadina/action-core"
import {
  EnvironmentCredentialResolver,
  PLAID_READ_ONLY_CONFIG,
  PLAID_SANDBOX_BASE_URL,
  createPlaidProviderAdapterFactory,
} from "@jhadina/money-core"
import type { ActionRequestIdentity, JhadinaActionRequest, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { runGovernedMoneyAccountRead } from "./governed-account-read-runtime"
import { createMoneyPlaidProductionRegistry, PLAID_PROVIDER } from "./production-provider"
import { MONEY_AUDIT_DOMAIN } from "./durable-audit-ledger"

/**
 * PL-8 Phase 2 (Jhadina OS Integration Phase 2, Money real-integration):
 * the live-run evidence suite against Plaid's real sandbox API — Money's
 * own version of PL-7's Stripe live-verification suite, same isolation
 * discipline.
 *
 * NEVER picked up by the default vitest.config.ts / `pnpm test` (the
 * required Launch Gate CI check) — that config's include glob only
 * matches `*.test.ts`/`*.spec.ts`, and this file deliberately ends in
 * `.live.ts`. The ONLY way this file runs is `pnpm exec vitest run
 * --config vitest.pl8-live.config.ts`, which only the dedicated
 * workflow_dispatch job (pl8-live-plaid-verification.yml) invokes — a
 * job that only ever runs when a human explicitly dispatches it. No
 * other workflow, PR, or push triggers it.
 *
 * Identity and audit, same call as PL-7 (Blocker B) for the identical
 * reasons: createRequestIdentityVerifier() requires a real Next.js
 * request/session context that doesn't exist in a standalone vitest
 * process, and durably proving Supabase's own RPC/auth path is out of
 * scope here (PL-5 already covers that for the shared ledger
 * mechanism). This suite uses a static, actor-scoped identity verifier
 * and the same faithful FakeAuditRpcClient shape PL-5/PL-7 validated —
 * not a live Supabase connection. Every scenario's evidence record says
 * so explicitly. What IS live and real here, with zero mocking: the
 * credential resolution, the sandbox-boundary/HTTPS enforcement, and
 * the actual PlaidReadOnlyAdapter -> Plaid sandbox /accounts/get call
 * — nothing in this file overrides global fetch.
 *
 * Credential shape required: JHADINA_SECRET_PLAID_DEFAULT must be a
 * JSON bundle `{"clientId": "...", "secret": "...", "accessToken":
 * "..."}` where accessToken is a real Plaid **sandbox** access token
 * already exchanged via Plaid's own /sandbox/public_token/create +
 * /item/public_token/exchange flow — Plaid's sandbox does not accept an
 * arbitrary access-token string. Provisioning that token is a
 * prerequisite to dispatching this workflow, not something this suite
 * does; this file only ever reads the already-resolved bundle.
 *
 * Secret hygiene: every sensitive field inside the resolved bundle
 * (clientId, secret, accessToken, and the raw bundle string itself) is
 * checked for leakage into evidence, exactly like PL-7's sk_test_
 * check. Every leak check is a boolean-only comparison assigned to a
 * variable before being asserted, specifically so a failing
 * assertion's own error message cannot print the secret.
 */

const LIVE_ACTOR_ID = "pl8-live-verification-actor"

function staticIdentityVerifier(): JhadinaIdentityVerifier {
  return {
    async verify(request: JhadinaActionRequest): Promise<ActionRequestIdentity> {
      if (request.userId !== LIVE_ACTOR_ID) throw new Error("Action identity mismatch")
      return { userId: LIVE_ACTOR_ID, sessionId: "pl8-live-verification-session" }
    },
  }
}

type FakeRow = {
  domain: string
  sequence: number
  event_id: string
  request_id: string
  actor_id: string
  capability: string
  status: string
  occurred_at: string
  metadata: Record<string, unknown>
}

/** The same faithful RPC double PL-5/PL-7 validated durability for — not a live Supabase connection. */
class FakeAuditRpcClient implements AuditRpcClient {
  private readonly rows: FakeRow[] = []
  private readonly sequenceByDomain = new Map<string, number>()

  async rpc<T = unknown>(fn: string, args: Record<string, unknown>) {
    if (fn === "append_jhadina_audit_event") {
      const domain = args.p_domain as string
      const sequence = (this.sequenceByDomain.get(domain) ?? 0) + 1
      this.sequenceByDomain.set(domain, sequence)
      this.rows.push({
        domain,
        sequence,
        event_id: args.p_event_id as string,
        request_id: args.p_request_id as string,
        actor_id: args.p_actor_id as string,
        capability: args.p_capability as string,
        status: args.p_status as string,
        occurred_at: args.p_occurred_at as string,
        metadata: (args.p_metadata as Record<string, unknown>) ?? {},
      })
      return { data: null as T | null, error: null }
    }
    if (fn === "list_jhadina_audit_events") {
      const domain = args.p_domain as string
      const actorId = args.p_actor_id as string
      const rows = this.rows.filter((r) => r.domain === domain && r.actor_id === actorId)
      return { data: rows as T, error: null }
    }
    return { data: null as T | null, error: { message: `Unknown RPC: ${fn}` } }
  }
}

const rpc = new FakeAuditRpcClient()
function freshLedger(): SupabaseAuditLedger {
  return new SupabaseAuditLedger({ client: rpc, domain: MONEY_AUDIT_DOMAIN })
}

type ScenarioEvidence = {
  scenario: string
  requestedOperation: string
  governedPathUsed: string
  plaidResult: unknown
  applicationResult: unknown
  auditEvidence: unknown
  actorAttribution: string
  secretExposureCheck: "clean"
}

const evidence: ScenarioEvidence[] = []

function record(e: ScenarioEvidence) {
  evidence.push(e)
  // Captured in the workflow_dispatch job's own log — GitHub Actions
  // automatically redacts the registered secret value anywhere it
  // would appear in step output, as a backstop behind the fact that
  // this code never puts it in `e` in the first place.
  console.log(`\n=== PL-8 EVIDENCE: ${e.scenario} ===\n${JSON.stringify(e, null, 2)}\n`)
}

describe("PL-8 — live Plaid sandbox boundary (workflow_dispatch only, never runs in normal CI)", () => {
  it("0. preflight: JHADINA_SECRET_PLAID_DEFAULT resolves server-side without exposing its value", async () => {
    const resolver = new EnvironmentCredentialResolver()
    const credential = await resolver.resolve(PLAID_READ_ONLY_CONFIG.credentialRef)
    const parsed = JSON.parse(credential.secret) as { clientId: string; secret: string; accessToken: string }

    expect(parsed.clientId.length).toBeGreaterThan(0)
    expect(parsed.secret.length).toBeGreaterThan(0)
    expect(parsed.accessToken.length).toBeGreaterThan(0)

    const evidenceJson = JSON.stringify(evidence)
    const leaked =
      evidenceJson.includes(credential.secret) ||
      evidenceJson.includes(parsed.clientId) ||
      evidenceJson.includes(parsed.secret) ||
      evidenceJson.includes(parsed.accessToken)
    expect(leaked).toBe(false)

    record({
      scenario: "0-preflight-credential-resolution",
      requestedOperation: `resolve ${PLAID_READ_ONLY_CONFIG.credentialRef} via EnvironmentCredentialResolver`,
      governedPathUsed: "credential-resolver.ts (unchanged, Phase 1) -- money/plaid/default -> JHADINA_SECRET_PLAID_DEFAULT",
      plaidResult: "n/a -- no Plaid call yet",
      applicationResult: "credential bundle resolved server-side and parsed; clientId/secret/accessToken all present and non-empty",
      auditEvidence: "n/a",
      actorAttribution: "n/a",
      secretExposureCheck: "clean",
    })
  })

  it("1. sandbox-boundary and HTTPS enforcement: the resolved Plaid endpoint is sandbox-bound, and a production host is rejected before any adapter exists", async () => {
    expect(PLAID_SANDBOX_BASE_URL).toBe("https://sandbox.plaid.com")
    expect(PLAID_SANDBOX_BASE_URL.startsWith("https://")).toBe(true)

    // The real production wiring (Phase 1, unmodified) succeeds under
    // whatever JHADINA_PLAID_BASE_URL this environment has (or, more
    // likely, doesn't have -- defaulting to the sandbox host).
    const registry = await createMoneyPlaidProductionRegistry()
    expect(registry.registry.list()).toEqual([PLAID_PROVIDER])

    // And the same guard actively rejects a production host, proven
    // live-adjacent rather than only trusted from money-core's own
    // unit test -- using the real resolver, never reached because the
    // guard fires before any credential resolution happens.
    const resolver = new EnvironmentCredentialResolver()
    let productionRejected = false
    try {
      createPlaidProviderAdapterFactory("https://production.plaid.com", resolver)
    } catch (error) {
      productionRejected = error instanceof Error && error.message === "PLAID_BASE_URL_MUST_BE_SANDBOX:https://production.plaid.com"
    }
    expect(productionRejected).toBe(true)

    record({
      scenario: "1-sandbox-boundary-and-https-enforcement",
      requestedOperation: "createMoneyPlaidProductionRegistry() (real path) + createPlaidProviderAdapterFactory('https://production.plaid.com', ...) (expected rejection)",
      governedPathUsed: "plaid-provider-registration.ts's assertPlaidSandboxBaseUrl, fired before any adapter/credential resolution",
      plaidResult: "n/a -- boundary check only, no Plaid call yet",
      applicationResult: { sandboxHostConfirmed: true, productionHostRejected: productionRejected },
      auditEvidence: "n/a",
      actorAttribution: "n/a",
      secretExposureCheck: "clean",
    })
  })

  it("2. an authenticated actor reaches the governed Money executor, the real PlaidReadOnlyAdapter calls Plaid's sandbox /accounts/get, and the response maps into real MoneyAccount[]", async () => {
    const providers = await createMoneyPlaidProductionRegistry()
    const result = await runGovernedMoneyAccountRead(LIVE_ACTOR_ID, `pl8-live-${Date.now()}`, {
      identityVerifier: staticIdentityVerifier(),
      supabase: rpc,
      providers,
    })

    expect(result.verifiedUserId).toBe(LIVE_ACTOR_ID)
    expect(Array.isArray(result.accounts)).toBe(true)
    expect(result.accounts.length).toBeGreaterThan(0)
    for (const account of result.accounts) {
      expect(account.provider).toBe(PLAID_PROVIDER)
      expect(typeof account.id).toBe("string")
      expect(typeof account.externalId).toBe("string")
      expect(typeof account.type).toBe("string")
      expect(typeof account.currency).toBe("string")
    }

    record({
      scenario: "2-authenticated-read-real-plaid-call-mapped-accounts",
      requestedOperation: "runGovernedMoneyAccountRead -- money.account.read against the real, unmocked PlaidReadOnlyAdapter",
      governedPathUsed: "identity -> SecurityCoreActionPolicy(MONEY_CORE_SECURITY_POLICY) -> MoneyProviderHealthGate -> assertCapability -> PlaidReadOnlyAdapter.listAccounts() -> POST /accounts/get (real fetch, nothing overridden)",
      plaidResult: { accountCount: result.accounts.length, sampleAccountType: result.accounts[0]?.type },
      applicationResult: { mappedAccountShape: "id/provider/externalId/type/currency all present on every account" },
      auditEvidence: "recorded via SupabaseAuditLedger over the same faithful RPC double PL-5/PL-7 validated durability for -- cross-instance read-back proven in scenario 3",
      actorAttribution: result.verifiedUserId,
      secretExposureCheck: "clean",
    })
  })

  it("3. a real durable audit event is recorded with domain 'money' and correct actor attribution", async () => {
    const trail = await freshLedger().list({ domain: MONEY_AUDIT_DOMAIN, actorId: LIVE_ACTOR_ID })

    expect(trail.length).toBeGreaterThan(0)
    const statuses = trail.map((e) => e.status)
    expect(statuses).toContain("started")
    expect(statuses).toContain("completed")
    expect(trail.every((e) => e.userId === LIVE_ACTOR_ID)).toBe(true)
    expect(trail.some((e) => e.userId !== LIVE_ACTOR_ID)).toBe(false)
    expect(trail.every((e) => e.type === "money.account.read")).toBe(true)

    record({
      scenario: "3-durable-audit-and-actor-attribution",
      requestedOperation: "SupabaseAuditLedger.list({domain: 'money', actorId: LIVE_ACTOR_ID}) via a fresh instance sharing only the underlying fake RPC table with scenario 2's writer",
      governedPathUsed: "same cross-instance read-back proof PL-5/PL-7 established for Growth/Commerce, now for Money",
      plaidResult: "n/a",
      applicationResult: { totalEvents: trail.length, statuses },
      auditEvidence:
        "IMPORTANT DISTINCTION: this ledger is the same faithful RPC double PL-5/PL-7 already validated durability for -- not a live Supabase connection. This proves the governed Money path correctly invokes SupabaseAuditLedger.append()/list() with real Plaid-derived data end to end, domain 'money'. It does NOT re-prove Supabase's own RPC/auth-enforcement durability -- PL-5 already covers that; live network calls to Supabase are deliberately out of scope for PL-8, same as PL-7.",
      actorAttribution: `all ${trail.length} events carry ${LIVE_ACTOR_ID}; zero anonymous, empty, or mismatched actors`,
      secretExposureCheck: "clean",
    })
  })

  it("4. final secret-hygiene self-check: no scenario's collected evidence contains the resolved credential", async () => {
    const resolver = new EnvironmentCredentialResolver()
    const credential = await resolver.resolve(PLAID_READ_ONLY_CONFIG.credentialRef)
    const parsed = JSON.parse(credential.secret) as { clientId: string; secret: string; accessToken: string }

    // Boolean-only comparisons -- if any of these ever fail, the
    // assertion message is "expected false, got true", never the
    // secret itself.
    const fullEvidenceJson = JSON.stringify(evidence)
    const leaked =
      fullEvidenceJson.includes(credential.secret) ||
      fullEvidenceJson.includes(parsed.clientId) ||
      fullEvidenceJson.includes(parsed.secret) ||
      fullEvidenceJson.includes(parsed.accessToken)
    expect(leaked).toBe(false)

    console.log(`\n=== PL-8 FULL EVIDENCE SUMMARY (${evidence.length} scenarios recorded) ===\n${fullEvidenceJson}\n`)
  })
})

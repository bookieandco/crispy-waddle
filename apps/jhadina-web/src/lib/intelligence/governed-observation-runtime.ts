import {
  ShodanHttpTransport,
  ShodanReadOnlyAdapter,
  appendObservationEvidence,
  type ShodanHttpClient,
  type ShodanReadCapability,
} from "@jhadina/intelligence-core"
import type { SupabaseAuditLedger } from "@jhadina/action-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createIntelligenceAuditLedger } from "./durable-audit-ledger"

export type ObservationRuntimeOverrides = {
  identityVerifier?: JhadinaIdentityVerifier
  ledger?: SupabaseAuditLedger
  http?: ShodanHttpClient
  apiKey?: string
  now?: () => string
}

export async function observeShodanGoverned(input: {
  claimedUserId?: string
  observationId: string
  subjectId: string
  capability: ShodanReadCapability
  observedAt?: string
}, overrides: ObservationRuntimeOverrides = {}) {
  const identityVerifier = overrides.identityVerifier ?? (await createRequestIdentityVerifier())
  const identity = await identityVerifier.verify(input.claimedUserId === undefined ? {} : { userId: input.claimedUserId })
  const ledger = overrides.ledger ?? (await createIntelligenceAuditLedger())
  const now = overrides.now ?? (() => new Date().toISOString())
  const http = overrides.http ?? (async (url, init) => {
    const response = await fetch(url, init)
    return { ok: response.ok, status: response.status, json: () => response.json() }
  })
  const transport = new ShodanHttpTransport(http, {
    async getApiKey() {
      const key = overrides.apiKey ?? process.env.JHADINA_SECRET_SHODAN_DEFAULT ?? ""
      if (!key.trim()) throw new Error("SHODAN_CREDENTIAL_REQUIRED")
      return key
    },
  })
  const adapter = new ShodanReadOnlyAdapter(transport)
  const envelope = await adapter.observe({
    observationId: input.observationId,
    subjectId: input.subjectId,
    capability: input.capability,
    observedAt: input.observedAt ?? now(),
    receivedAt: now(),
  })
  await appendObservationEvidence({ ledger, actorId: identity.userId, envelope })
  return { envelope, verifiedUserId: identity.userId }
}

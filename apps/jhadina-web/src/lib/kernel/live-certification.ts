import {
  VerifiedActionExecutor,
  createBaseSecurityCoreActionPolicy,
  type ActionHandler,
  type ActionRequest,
} from "@jhadina/action-core"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import { createIntelligenceAuditLedger, INTELLIGENCE_AUDIT_DOMAIN } from "../intelligence/durable-audit-ledger"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { getCanonicalMemoryStorage } from "../storage/createMemoryStorage"

export const KERNEL_CERT_CAPABILITY = "memory.read"

export interface KernelCertReadAction {
  probe: "kernel-cert"
}

export interface KernelCertResult {
  actionId: string
  userId: string
  memoryStats: Awaited<ReturnType<MemoryRepository["getStats"]>>
  auditCompleted: boolean
  commitSha: string | null
}

function handler(memoryRepo: MemoryRepository): ActionHandler<KernelCertReadAction, KernelCertResult> {
  return {
    supports: (type) => type === KERNEL_CERT_CAPABILITY,
    async execute(_action, request) {
      return {
        actionId: request.id,
        userId: request.userId,
        memoryStats: await memoryRepo.getStats(request.userId),
        auditCompleted: false,
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null,
      }
    },
  }
}

function actionIdentity(identityVerifier: JhadinaIdentityVerifier) {
  return {
    verify: (request: ActionRequest<KernelCertReadAction>) =>
      identityVerifier.verify({ userId: request.userId }),
  }
}

/**
 * Side-effect-light live proof of the canonical kernel.
 *
 * This uses an existing read capability and the existing Intelligence durable
 * audit ledger. It creates no second policy/executor/ledger and performs no
 * publishing, spending, external communication, or durable business mutation.
 */
export async function runKernelLiveCertification(): Promise<KernelCertResult> {
  const identityVerifier = await createRequestIdentityVerifier()
  const identity = await identityVerifier.verify({})
  const ledger = await createIntelligenceAuditLedger()
  const memoryRepo = new MemoryRepository(getCanonicalMemoryStorage())
  const policy = createBaseSecurityCoreActionPolicy<KernelCertReadAction>("kernel-cert")
  const executor = new VerifiedActionExecutor(
    actionIdentity(identityVerifier),
    policy,
    ledger,
    [handler(memoryRepo)],
  )
  const actionId = `kernel-cert:${crypto.randomUUID()}`
  const request: ActionRequest<KernelCertReadAction> = {
    id: actionId,
    userId: identity.userId,
    type: KERNEL_CERT_CAPABILITY,
    action: { probe: "kernel-cert" },
    requestedAt: new Date().toISOString(),
  }

  const result = await executor.execute(request)
  const events = await ledger.list({ domain: INTELLIGENCE_AUDIT_DOMAIN, actorId: identity.userId })
  const completed = events.some((event) =>
    event.actionId === actionId && event.type === KERNEL_CERT_CAPABILITY && event.status === "completed"
  )
  if (!completed) throw new Error("JHADINA_KERNEL_CERT_AUDIT_READBACK_MISSING")
  return { ...result, auditCompleted: true }
}

export async function readKernelLiveCertification(actionId: string) {
  if (!actionId.trim()) throw new Error("JHADINA_KERNEL_CERT_ACTION_ID_REQUIRED")
  const identityVerifier = await createRequestIdentityVerifier()
  const identity = await identityVerifier.verify({})
  const ledger = await createIntelligenceAuditLedger()
  const events = await ledger.list({ domain: INTELLIGENCE_AUDIT_DOMAIN, actorId: identity.userId })
  const actionEvents = events.filter((event) => event.actionId === actionId)
  return {
    actionId,
    userId: identity.userId,
    persisted: actionEvents.some((event) => event.status === "completed"),
    events: actionEvents,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null,
  }
}

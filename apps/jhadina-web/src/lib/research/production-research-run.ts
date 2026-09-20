import type { ResearchProvider } from "../../../../../packages/jhadina-research-core/src/research-executor.js"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { createResearchAuditLedger } from "./research-audit-ledger"
import { createSupabaseResearchExecutionAuthorityRepository } from "./research-execution-authority-repository"
import { createSupabaseResearchRuntimeRepository } from "./supabase-research-runtime-repository"
import {
  executeResearchRunGoverned,
  type ResearchRunAction,
} from "./governed-research-run"

export async function executeResearchRunProduction(input: {
  userId: string
  planId: string
  policyDecisionId: string
  provider: ResearchProvider
  workerId?: string
  leaseSeconds?: number
  approvalReceiptId?: string
}) {
  const [identityVerifier, ledger] = await Promise.all([
    createRequestIdentityVerifier(),
    createResearchAuditLedger(),
  ])

  const action: ResearchRunAction = {
    planId: input.planId,
    policyDecisionId: input.policyDecisionId,
    workerId: input.workerId ?? `research-worker:${crypto.randomUUID()}`,
    leaseSeconds: input.leaseSeconds,
  }

  return executeResearchRunGoverned(
    {
      identityVerifier,
      ledger,
      authority: createSupabaseResearchExecutionAuthorityRepository(),
      runtimeRepository: createSupabaseResearchRuntimeRepository(),
      provider: input.provider,
    },
    input.userId,
    action,
    { approvalReceiptId: input.approvalReceiptId },
  )
}

import {
  ActionExecutor,
  createApprovalReceiptVerifier,
  createBaseSecurityCoreActionPolicy,
  type ActionHandler,
  type ActionLedger,
  type ActionPolicy,
  type ActionRequest,
  type ApprovalReceiptStore,
} from "@jhadina/action-core"
import type { JhadinaIdentityVerifier } from "@/lib/auth/supabase-identity-verifier"
import {
  GovernedResearchExecutor,
  type GovernedResearchExecutionResult,
  type ResearchProvider,
} from "../../../../../packages/jhadina-research-core/src/research-executor.js"
import type { ResearchRuntimeRepository } from "../../../../../packages/jhadina-research-core/src/runtime-repository.js"
import type { ResearchExecutionAuthorityRepository } from "./research-execution-authority-repository"
import { RESEARCH_AUDIT_DOMAIN } from "./research-audit-ledger"

export const RESEARCH_RUN_CAPABILITY = "research.run"

export interface ResearchRunAction {
  planId: string
  policyDecisionId: string
  workerId: string
  leaseSeconds?: number
}

function fingerprintResearchRun(action: ResearchRunAction): string {
  return [
    RESEARCH_RUN_CAPABILITY,
    action.planId,
    action.policyDecisionId,
    action.workerId,
    String(action.leaseSeconds ?? 300),
  ].join(":")
}

export function createResearchRunHandler(input: {
  authority: ResearchExecutionAuthorityRepository
  runtimeRepository: ResearchRuntimeRepository
  provider: ResearchProvider
}): ActionHandler<ResearchRunAction, GovernedResearchExecutionResult> {
  return {
    supports: (type) => type === RESEARCH_RUN_CAPABILITY,
    async execute(action, request) {
      // This handler is reachable only after ActionExecutor has appended its
      // durable "started" audit event and deterministic policy has allowed the
      // request (and consumed an approval receipt, if policy required one).
      const executionReceiptId = await input.authority.authorize({
        planId: action.planId,
        policyDecisionId: action.policyDecisionId,
        requestId: request.id,
        actorId: request.userId,
        auditDomain: RESEARCH_AUDIT_DOMAIN,
      })
      if (!executionReceiptId) {
        throw new Error("Research execution authority receipt was not issued")
      }

      return new GovernedResearchExecutor(input.runtimeRepository, input.provider).executeNext({
        planId: action.planId,
        policyDecisionId: action.policyDecisionId,
        workerId: action.workerId,
        leaseSeconds: action.leaseSeconds,
      })
    },
  }
}

export interface GovernedResearchRunDeps {
  identityVerifier: JhadinaIdentityVerifier
  ledger: ActionLedger
  authority: ResearchExecutionAuthorityRepository
  runtimeRepository: ResearchRuntimeRepository
  provider: ResearchProvider
  policy?: ActionPolicy<ResearchRunAction>
  approvalStore?: ApprovalReceiptStore
}

export async function executeResearchRunGoverned(
  deps: GovernedResearchRunDeps,
  claimedUserId: string,
  action: ResearchRunAction,
  options: { requestId?: string; approvalReceiptId?: string } = {},
): Promise<{ result: GovernedResearchExecutionResult; verifiedUserId: string; requestId: string }> {
  const identity = await deps.identityVerifier.verify({ userId: claimedUserId })
  const requestId = options.requestId ?? `research-run:${action.planId}:${crypto.randomUUID()}`

  const request: ActionRequest<ResearchRunAction> = {
    id: requestId,
    userId: identity.userId,
    type: RESEARCH_RUN_CAPABILITY,
    action,
    requestedAt: new Date().toISOString(),
    approvalReceiptId: options.approvalReceiptId,
  }

  const policy = deps.policy ?? createBaseSecurityCoreActionPolicy<ResearchRunAction>("research")
  const approvalVerifier = deps.approvalStore
    ? createApprovalReceiptVerifier(deps.approvalStore, (candidate) =>
        fingerprintResearchRun(candidate.action as ResearchRunAction),
      )
    : undefined

  const executor = new ActionExecutor(
    policy,
    deps.ledger,
    [createResearchRunHandler({
      authority: deps.authority,
      runtimeRepository: deps.runtimeRepository,
      provider: deps.provider,
    })],
    approvalVerifier,
  )

  const result = await executor.execute(request)
  return { result, verifiedUserId: identity.userId, requestId }
}

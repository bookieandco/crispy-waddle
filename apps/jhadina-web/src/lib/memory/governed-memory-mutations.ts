import {
  InMemoryApprovalReceiptStore,
  JhadinaValuesActionPolicy,
  VerifiedActionExecutor,
  createApprovalReceiptVerifier,
  createApprovalRequestService,
  type ActionHandler,
  type ActionLedger,
  type ActionPolicy,
  type ActionRequest,
  type ApprovalReceiptStore,
} from "@jhadina/action-core"
import {
  JHADINA_BASE_SECURITY_POLICY,
  JHADINA_DEFAULT_VALUES_CONFIGURATION,
} from "@jhadina/security-core"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import type { Memory, MemoryCandidate } from "../storage/InMemoryStorage"

export const MEMORY_COMMIT_CAPABILITY = "memory.commit"
export const MEMORY_REJECT_CAPABILITY = "memory.reject"
export const MEMORY_CORRECT_CAPABILITY = "memory.correct"
export const MEMORY_FORGET_CAPABILITY = "memory.forget"

export type MemoryMutationAction =
  | { kind: "approve"; candidateId: string }
  | { kind: "reject"; candidateId: string }
  | { kind: "correct"; memoryId: string; content: string }
  | { kind: "forget"; memoryId: string }

export type MemoryMutationResult =
  | { kind: "approve"; status: "APPROVED"; memoryId: string }
  | { kind: "reject"; status: "REJECTED"; candidate: MemoryCandidate }
  | { kind: "correct"; retiredMemoryId: string; memory: Memory; reasoningEventId: string }
  | { kind: "forget"; memoryId: string; status: Memory["status"]; reasoningEventId: string }

export interface GovernedMemoryMutationDeps {
  identityVerifier: JhadinaIdentityVerifier
  ledger: ActionLedger
  memoryRepo: MemoryRepository
  reasoningRepo: ReasoningEventRepository
  timelineRepo: TimelineRepository
  approvalStore?: ApprovalReceiptStore
  policy?: ActionPolicy<MemoryMutationAction>
}

function capabilityFor(action: MemoryMutationAction): string {
  switch (action.kind) {
    case "approve": return MEMORY_COMMIT_CAPABILITY
    case "reject": return MEMORY_REJECT_CAPABILITY
    case "correct": return MEMORY_CORRECT_CAPABILITY
    case "forget": return MEMORY_FORGET_CAPABILITY
  }
}

function fingerprintMutation(type: string, action: MemoryMutationAction): string {
  switch (action.kind) {
    case "approve": return `${type}:${action.candidateId}`
    case "reject": return `${type}:${action.candidateId}`
    case "correct": return `${type}:${action.memoryId}:${action.content.trim()}`
    case "forget": return `${type}:${action.memoryId}`
  }
}

function createMemoryMutationHandler(
  memoryRepo: MemoryRepository,
  reasoningRepo: ReasoningEventRepository,
  timelineRepo: TimelineRepository,
): ActionHandler<MemoryMutationAction, MemoryMutationResult> {
  return {
    supports(type) {
      return type === MEMORY_COMMIT_CAPABILITY
        || type === MEMORY_REJECT_CAPABILITY
        || type === MEMORY_CORRECT_CAPABILITY
        || type === MEMORY_FORGET_CAPABILITY
    },
    async execute(action, request) {
      if (request.type !== capabilityFor(action)) {
        throw new Error("JHADINA_MEMORY_MUTATION_CAPABILITY_MISMATCH")
      }

      if (action.kind === "approve") {
        const memory = await memoryRepo.approve(action.candidateId, request.userId)
        await timelineRepo.recordApproval({
          userId: request.userId,
          memoryId: memory.id,
          memoryType: memory.type,
          memoryContent: memory.content,
        })
        return { kind: "approve", status: "APPROVED", memoryId: memory.id }
      }

      if (action.kind === "reject") {
        const candidate = await memoryRepo.reject(action.candidateId, request.userId)
        await timelineRepo.recordRejection({
          userId: request.userId,
          memoryId: candidate.id,
          memoryType: candidate.type,
          memoryContent: candidate.content,
        })
        return { kind: "reject", status: "REJECTED", candidate }
      }

      if (action.kind === "correct") {
        const content = action.content.trim()
        if (!content) throw new Error("JHADINA_MEMORY_CORRECTION_CONTENT_REQUIRED")
        const current = await memoryRepo.getById(request.userId, action.memoryId)
        if (!current || current.status !== "APPROVED") {
          throw new Error("JHADINA_MEMORY_CORRECTION_TARGET_INVALID")
        }
        const reasoning = await reasoningRepo.create({
          userId: request.userId,
          userMessage: content,
          observation: { raw: content, extracted: content, timestamp: request.requestedAt },
          classification: { type: current.type, confidence: 1, reasoning: "explicit user memory correction" },
          systemResponse: "Memory correction recorded.",
          confidence: 1,
          actor: "user",
          outcome: "memory:corrected",
          causationId: current.reasoningEventId,
          metadata: { kind: "memory-correction", targetMemoryId: current.id, authority: "explicit-user" },
        })
        const corrected = await memoryRepo.correct({
          memoryId: current.id,
          userId: request.userId,
          content,
          reasoningEventId: reasoning.id,
          confidence: 1,
        })
        await timelineRepo.recordCorrection({
          userId: request.userId,
          memoryId: corrected.replacement.id,
          memoryType: corrected.replacement.type,
          memoryContent: corrected.replacement.content,
          reasoningEventId: reasoning.id,
        })
        return {
          kind: "correct",
          retiredMemoryId: corrected.retired.id,
          memory: corrected.replacement,
          reasoningEventId: reasoning.id,
        }
      }

      const current = await memoryRepo.getById(request.userId, action.memoryId)
      if (!current || current.status !== "APPROVED") {
        throw new Error("JHADINA_MEMORY_FORGET_TARGET_INVALID")
      }
      const reasoning = await reasoningRepo.create({
        userId: request.userId,
        userMessage: `Forget memory ${current.id}`,
        observation: { raw: `Forget memory ${current.id}`, extracted: current.id, timestamp: request.requestedAt },
        classification: { type: current.type, confidence: 1, reasoning: "explicit user memory forget request" },
        systemResponse: "Memory retired from active recall.",
        confidence: 1,
        actor: "user",
        outcome: "memory:forgotten",
        causationId: current.reasoningEventId,
        metadata: { kind: "memory-forget", targetMemoryId: current.id, authority: "explicit-user" },
      })
      const retired = await memoryRepo.forget(current.id, request.userId)
      await timelineRepo.recordForget({
        userId: request.userId,
        memoryId: retired.id,
        memoryType: retired.type,
      })
      return {
        kind: "forget",
        memoryId: retired.id,
        status: retired.status,
        reasoningEventId: reasoning.id,
      }
    },
  }
}

export async function runMemoryMutationGoverned(
  deps: GovernedMemoryMutationDeps,
  claimedUserId: string,
  action: MemoryMutationAction,
): Promise<{ result: MemoryMutationResult; verifiedUserId: string; approvalReceiptId?: string }> {
  // A failed identity assertion cannot be attributed to the unverified claimed
  // actor. Fail before writing a user-scoped audit event; the authenticated
  // audit RPC intentionally refuses such spoofed attribution.
  const identity = await deps.identityVerifier.verify({ userId: claimedUserId })
  const type = capabilityFor(action)
  const actionId = `${type}:${crypto.randomUUID()}`
  const requestedAt = new Date().toISOString()
  const request: ActionRequest<MemoryMutationAction> = {
    id: actionId,
    userId: identity.userId,
    type,
    action,
    requestedAt,
  }

  const policy = deps.policy ?? new JhadinaValuesActionPolicy<MemoryMutationAction>(
    JHADINA_BASE_SECURITY_POLICY,
    JHADINA_DEFAULT_VALUES_CONFIGURATION,
  )
  const decision = await policy.evaluate(request)
  await deps.ledger.append({
    id: `${actionId}:policy-evaluated`,
    actionId,
    userId: identity.userId,
    type,
    status: decision === "deny" ? "denied" : decision === "approval_required" ? "approval_required" : "started",
    timestamp: requestedAt,
    metadata: { stage: "policy", decision },
  })
  if (decision === "deny") throw new Error(`Action denied by policy: ${type}`)

  const approvalStore = deps.approvalStore ?? new InMemoryApprovalReceiptStore()
  const fingerprint = (r: ActionRequest<MemoryMutationAction>) => fingerprintMutation(r.type, r.action)
  const approvalVerifier = createApprovalReceiptVerifier(approvalStore, (r) =>
    fingerprint(r as ActionRequest<MemoryMutationAction>),
  )
  const actionIdentity = {
    verify: (r: ActionRequest<MemoryMutationAction>) => deps.identityVerifier.verify({ userId: r.userId }),
  }
  const executor = new VerifiedActionExecutor(
    actionIdentity,
    policy,
    deps.ledger,
    [createMemoryMutationHandler(deps.memoryRepo, deps.reasoningRepo, deps.timelineRepo)],
    approvalVerifier,
  )

  let approvalReceiptId: string | undefined
  if (decision === "approval_required") {
    const approvalService = createApprovalRequestService(approvalStore, (r) =>
      fingerprint(r as ActionRequest<MemoryMutationAction>),
    )
    const pending = await approvalService.requestApproval(request)
    const approved = await approvalService.approve(pending.id, identity.userId)
    approvalReceiptId = approved.id
  }

  const result = await executor.execute(approvalReceiptId ? { ...request, approvalReceiptId } : request)
  return { result, verifiedUserId: identity.userId, approvalReceiptId }
}

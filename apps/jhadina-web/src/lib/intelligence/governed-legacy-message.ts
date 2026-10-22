import {
  JhadinaValuesActionPolicy,
  VerifiedActionExecutor,
  type ActionHandler,
  type ActionLedger,
  type ActionPolicy,
  type ActionRequest,
} from "@jhadina/action-core"
import {
  JHADINA_BASE_SECURITY_POLICY,
  JHADINA_DEFAULT_VALUES_CONFIGURATION,
} from "@jhadina/security-core"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { Classifier } from "../services/Classifier"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import type { Classification, MemoryCandidate } from "../storage/InMemoryStorage"
import { MEMORY_PROPOSE_CAPABILITY } from "./memory-propose-capability"

interface LegacyMessageAction {
  message: string
  classification: Classification
  systemResponse: string
}

export interface GovernedLegacyMessageDeps {
  identityVerifier: JhadinaIdentityVerifier
  ledger: ActionLedger
  memoryRepo: MemoryRepository
  reasoningRepo: ReasoningEventRepository
  timelineRepo: TimelineRepository
  classifier?: Classifier
  policy?: ActionPolicy<LegacyMessageAction>
}

export interface GovernedLegacyMessageResult {
  response: string
  reasoningEventId: string
  classification: Classification
  memoryCandidate: MemoryCandidate
  confidence: number
}

function generateLegacyResponse(classification: Classification, message: string): string {
  const confidence = (classification.confidence * 100).toFixed(0)
  switch (classification.type) {
    case "PREFERENCE":
      return `I've noted that ${message.toLowerCase()}. This is stored as a preference (${confidence}% confidence) and is pending your approval.`
    case "IDENTITY":
      return `I'll remember that ${message.toLowerCase()}. This is stored as an identity statement (${confidence}% confidence) and is pending your approval.`
    case "GOAL":
      return `I understand your goal: ${message.toLowerCase()}. This is stored as a goal (${confidence}% confidence) and is pending your approval.`
    case "CONTEXT":
      return `Got it. I'm storing this context: ${message.toLowerCase()} (${confidence}% confidence). It's pending your approval.`
  }
}

function legacyMessageHandler(
  memoryRepo: MemoryRepository,
  reasoningRepo: ReasoningEventRepository,
  timelineRepo: TimelineRepository,
): ActionHandler<LegacyMessageAction, GovernedLegacyMessageResult> {
  return {
    supports: (type) => type === MEMORY_PROPOSE_CAPABILITY,
    async execute(action, request) {
      const observation = {
        raw: action.message,
        extracted: action.message.trim(),
        timestamp: request.requestedAt,
      }
      const reasoningEventId = `reason_${crypto.randomUUID()}`
      const candidate = await memoryRepo.createCandidate({
        userId: request.userId,
        content: action.message,
        type: action.classification.type,
        confidence: action.classification.confidence,
        reasoningEventId,
      })
      const reasoning = await reasoningRepo.create({
        id: reasoningEventId,
        userId: request.userId,
        userMessage: action.message,
        observation,
        classification: action.classification,
        systemResponse: action.systemResponse,
        confidence: action.classification.confidence,
        candidateId: candidate.id,
      })
      await timelineRepo.recordReasoning({
        userId: request.userId,
        reasoningEventId: reasoning.id,
        userMessage: action.message,
        systemResponse: reasoning.systemResponse,
      })
      return {
        response: reasoning.systemResponse,
        reasoningEventId: reasoning.id,
        classification: action.classification,
        memoryCandidate: candidate,
        confidence: action.classification.confidence,
      }
    },
  }
}

/**
 * Compatibility bridge for POST /api/message.
 *
 * The legacy classifier stays deterministic, but its durable candidate creation
 * now traverses the same verified identity -> values/security policy ->
 * VerifiedActionExecutor -> durable audit spine as Ask Jhadina. This is not a
 * second execution pathway; it is an adapter into the canonical one.
 */
export async function processLegacyMessageGoverned(
  deps: GovernedLegacyMessageDeps,
  claimedUserId: string,
  message: string,
): Promise<GovernedLegacyMessageResult> {
  const identity = await deps.identityVerifier.verify({ userId: claimedUserId })
  const classifier = deps.classifier ?? new Classifier()
  const classification = classifier.classify(message)
  const action: LegacyMessageAction = {
    message,
    classification,
    systemResponse: generateLegacyResponse(classification, message),
  }
  const requestedAt = new Date().toISOString()
  const actionId = `legacy-memory-propose:${crypto.randomUUID()}`
  const request: ActionRequest<LegacyMessageAction> = {
    id: actionId,
    userId: identity.userId,
    type: MEMORY_PROPOSE_CAPABILITY,
    action,
    requestedAt,
  }
  const policy = deps.policy ?? new JhadinaValuesActionPolicy<LegacyMessageAction>(
    JHADINA_BASE_SECURITY_POLICY,
    JHADINA_DEFAULT_VALUES_CONFIGURATION,
  )
  const decision = await policy.evaluate(request)
  await deps.ledger.append({
    id: `${actionId}:policy-evaluated`,
    actionId,
    userId: identity.userId,
    type: MEMORY_PROPOSE_CAPABILITY,
    status: decision === "deny" ? "denied" : decision === "approval_required" ? "approval_required" : "started",
    timestamp: requestedAt,
    metadata: { stage: "policy", decision, compatibilityRoute: "/api/message" },
  })
  if (decision !== "allow") {
    throw new Error(`Legacy memory proposal not allowed by policy: ${decision}`)
  }

  const actionIdentity = {
    verify: (r: ActionRequest<LegacyMessageAction>) => deps.identityVerifier.verify({ userId: r.userId }),
  }
  const executor = new VerifiedActionExecutor(
    actionIdentity,
    policy,
    deps.ledger,
    [legacyMessageHandler(deps.memoryRepo, deps.reasoningRepo, deps.timelineRepo)],
  )
  return executor.execute(request)
}

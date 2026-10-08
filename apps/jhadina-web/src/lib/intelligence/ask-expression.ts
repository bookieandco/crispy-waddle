import { composeLiveConversationCraft, type DecisionProposal, type ExpressionDirective, type PersonalityState, type QuipCandidateGenerator } from "@jhadina/core-spine"
import {
  realizeGovernedExpression,
  type GovernedExpressionRealization,
} from "@jhadina/intelligence-core"
import { deriveBehaviorContext, type PersonalityContextProvider } from "../context/context-builder"
import { redactSecrets } from "../context/redact"
import { getStorage } from "../routes/handlers"
import { createProductionPersonalityContextProvider } from "../personality/production-personality-context-provider"
import { createProductionQuipGenerator } from "../personality/live-quip-provider"
import { recordPersonalityDriftObservation } from "../personality/personality-drift-observer"

export interface AskJhadinaExpressionInput {
  userId: string
  activeTask: string
  proposal: DecisionProposal
}

export interface AskJhadinaExpressionOverrides {
  personalityContextProvider?: PersonalityContextProvider
  quipGenerator?: QuipCandidateGenerator
}

function dispositionMode(
  disposition: DecisionProposal["disposition"],
): ExpressionDirective["mode"] | undefined {
  if (disposition === "ASK") return "clarifying"
  if (disposition === "DECLINE") return "pushback"
  return undefined
}

/**
 * Canonical presentation boundary for deterministic Ask Jhadina shortcuts.
 *
 * General reasoning already flows through ContextPacket -> JLLM/model provider,
 * where personality and expressionDirective are read-only model inputs. This
 * helper closes the shortcut gap: Social/Growth/Director/Doctor responses still
 * keep their deterministic semantic truth, while presentation comes from the
 * same governed Pattern -> Personality -> Real Nigga Core -> Behavioral Kernel
 * -> Expression Kernel path.
 */
export async function realizeAskJhadinaExpression(
  input: AskJhadinaExpressionInput,
  overrides: AskJhadinaExpressionOverrides = {},
): Promise<GovernedExpressionRealization> {
  const provider = overrides.personalityContextProvider
    ?? createProductionPersonalityContextProvider(getStorage(), input.userId)
  const { redacted: activeTask } = redactSecrets(input.activeTask)

  const behaviorContext = deriveBehaviorContext(activeTask)
  let directive: ExpressionDirective | undefined
  let personality: PersonalityState | undefined
  try {
    const contribution = await provider.getContext({
      userId: input.userId,
      activeTask,
      behaviorContext,
    })
    directive = contribution.expressionDirective
    personality = contribution.personality
  } catch {
    directive = undefined
  }

  const requiredMode = dispositionMode(input.proposal.disposition)
  if (directive && requiredMode) directive = { ...directive, mode: requiredMode }
  if (!directive) {
    directive = {
      mode: requiredMode ?? "direct",
      allowProfanity: false,
      allowQuip: false,
    }
  }

  // Reuse the same post-decision craft boundary for deterministic shortcuts.
  // Never let generated presentation change specialist semantic output.
  if (personality && directive.allowQuip && input.proposal.disposition === "PROCEED") {
    const generator = overrides.quipGenerator ?? createProductionQuipGenerator({
      activeTask,
      semanticAnswer: input.proposal.recommendation,
      allowProfanity: directive.allowProfanity,
    })
    const craft = await composeLiveConversationCraft({
      personality,
      behaviorContext,
      currentTurn: activeTask,
      semanticAnswer: input.proposal.recommendation,
      disposition: input.proposal.disposition,
      generator,
      selectionSeed: input.proposal.id,
    })
    if (craft.directive.quip) directive = { ...directive, quip: craft.directive.quip }
    if (craft.directive.callback && craft.directive.callbackProvenance) {
      directive = {
        ...directive,
        callback: craft.directive.callback,
        callbackProvenance: craft.directive.callbackProvenance,
      }
    }
  }

  const realization = realizeGovernedExpression(input.proposal, directive)
  if (personality) {
    await recordPersonalityDriftObservation({
      userId: input.userId,
      requestId: input.proposal.id,
      personality,
      behaviorContext,
      realization,
    })
  }
  return realization
}

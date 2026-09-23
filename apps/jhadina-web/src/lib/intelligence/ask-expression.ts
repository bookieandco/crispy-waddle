import type { DecisionProposal, ExpressionDirective } from "@jhadina/core-spine"
import {
  realizeGovernedExpression,
  type GovernedExpressionRealization,
} from "@jhadina/intelligence-core"
import type { PersonalityContextProvider } from "../context/context-builder"
import { redactSecrets } from "../context/redact"
import { getStorage } from "../routes/handlers"
import { createProductionPersonalityContextProvider } from "../personality/production-personality-context-provider"

export interface AskJhadinaExpressionInput {
  userId: string
  activeTask: string
  proposal: DecisionProposal
}

export interface AskJhadinaExpressionOverrides {
  personalityContextProvider?: PersonalityContextProvider
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

  let directive: ExpressionDirective | undefined
  try {
    const contribution = await provider.getContext({
      userId: input.userId,
      activeTask,
    })
    directive = contribution.expressionDirective
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

  return realizeGovernedExpression(input.proposal, directive)
}

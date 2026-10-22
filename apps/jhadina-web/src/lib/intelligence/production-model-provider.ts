import { AnthropicModelProvider, GeminiModelProvider, IntelligenceRouter, type IntelligenceRouterEvent } from "@jhadina/intelligence-core"
import { LegacyClassifierProvider } from "./legacy-classifier-provider"

/**
 * Step 3's real composition root: exactly one primary model provider
 * (Anthropic by default, Gemini only with explicit opt-in), with the legacy regex Classifier wired in as the
 * fallback. Mirrors Money's createMoneyPlaidProductionRegistry() and
 * Commerce's production-payment-provider.ts — real, production-composed
 * code, fail-closed on a missing credential, no live call proven end to
 * end in this environment (no ANTHROPIC_API_KEY exists here — see
 * apps/jhadina-web/.env.example).
 *
 * AnthropicModelProvider resolves its own credential lazily (inside
 * propose(), not its constructor) precisely so that a missing key
 * surfaces as an ordinary provider failure IntelligenceRouter already
 * knows how to catch and fall back from, rather than a construction-time
 * throw that would happen before the router exists. This function itself
 * never reads or holds the credential.
 */
export function createProductionIntelligenceRouter(
  onEvent?: (event: IntelligenceRouterEvent) => void,
): IntelligenceRouter {
  return new IntelligenceRouter({
    primary: process.env.JHADINA_REASONING_PROVIDER === "gemini"
      ? new GeminiModelProvider()
      : new AnthropicModelProvider(),
    fallback: new LegacyClassifierProvider(),
    onEvent,
  })
}

/**
 * Configuration-only health projection for Ask. This intentionally performs
 * no model API request, bills no provider and never exports credential values.
 * Operational success remains UNVERIFIED until an owner-authenticated canary.
 */
export type JllmReasoningReadiness = Readonly<{
  selected: "anthropic" | "gemini"
  status: "CONFIGURED_UNVERIFIED" | "NOT_CONFIGURED"
  alternativeAvailable: "anthropic" | "gemini" | null
  fallback: "legacy-classifier"
  generalReasoningReady: false
  note: string
}>

export function readJllmReasoningReadiness(env: Pick<NodeJS.ProcessEnv,
  "JHADINA_REASONING_PROVIDER" | "ANTHROPIC_API_KEY" | "GEMINI_API_KEY"
> = process.env): JllmReasoningReadiness {
  const selected = env.JHADINA_REASONING_PROVIDER === "gemini" ? "gemini" : "anthropic"
  const configured = Boolean((selected === "gemini" ? env.GEMINI_API_KEY : env.ANTHROPIC_API_KEY)?.trim())
  const alternative = selected === "gemini" ? "anthropic" : "gemini"
  const alternateConfigured = Boolean((alternative === "gemini" ? env.GEMINI_API_KEY : env.ANTHROPIC_API_KEY)?.trim())
  return {
    selected,
    status: configured ? "CONFIGURED_UNVERIFIED" : "NOT_CONFIGURED",
    alternativeAvailable: alternateConfigured ? alternative : null,
    fallback: "legacy-classifier",
    generalReasoningReady: false,
    note: configured
      ? "A primary reasoning credential is configured. A successful authenticated model answer has not been verified by this status check."
      : "The selected reasoning model is not configured. The legacy classifier can classify requests but cannot produce a general reasoning answer.",
  }
}

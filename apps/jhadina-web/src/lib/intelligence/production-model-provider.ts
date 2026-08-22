import { AnthropicModelProvider, IntelligenceRouter, type IntelligenceRouterEvent } from "@jhadina/intelligence-core"
import { LegacyClassifierProvider } from "./legacy-classifier-provider"

/**
 * Step 3's real composition root: exactly one primary model provider
 * (Anthropic), with the legacy regex Classifier wired in as the
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
    primary: new AnthropicModelProvider(),
    fallback: new LegacyClassifierProvider(),
    onEvent,
  })
}

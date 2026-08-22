import type { ContextPacket, DecisionProposal } from '@jhadina/core-spine';

/**
 * Jhadina Intelligence Router (Phase 1, Step 3).
 *
 * This is the "brain interface," not a brain, and not an authority.
 * It implements `@jhadina/core-spine`'s existing `DecisionPort` — the
 * interface `JhadinaSpine.run()` already calls at exactly one stage of the
 * governed lifecycle (memory -> pattern -> personality -> context ->
 * DECISION -> policy -> action -> audit) — rather than defining a new
 * "decision" shape. JH-046 already settled this: core-spine's pipeline is
 * canonical over a duplicate `jhadina-intelligence-contract` package, so
 * this router plugs into the existing contract instead of inventing one.
 *
 * A `ModelProvider` takes a bounded `ContextPacket` in and returns a
 * `DecisionProposal` out — evidence, rationale, confidence-bearing
 * uncertainty, alternatives, and a `disposition` of PROCEED/ASK/DECLINE/
 * DEFER. Nothing in that shape lets a provider execute anything: there is
 * no handler, no side-effecting method, no capability grant anywhere on
 * `ModelProvider` or `DecisionProposal`. Turning a PROCEED proposal into a
 * real `ActionRequest` is a separate, explicit step the router does not
 * perform (see translateProposalToActionRequest.ts) — and that step never
 * reads a capability from the model's own output (see that file's header
 * for why). Everything downstream of a proposal still goes through the
 * same deterministic Policy -> Approval -> ActionExecutor -> Audit path
 * every other domain in this repo already uses.
 */

export interface ModelProvider {
  /** Stable identifier for audit/logging — e.g. "anthropic", "legacy-classifier". */
  readonly name: string;
  propose(context: ContextPacket): Promise<DecisionProposal>;
}

export class ModelProviderFailedError extends Error {
  constructor(
    public readonly providerName: string,
    public readonly cause: unknown,
  ) {
    super(
      `MODEL_PROVIDER_FAILED:${providerName}:${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = 'ModelProviderFailedError';
  }
}

export type IntelligenceRouterEvent =
  | { stage: 'primary_failed'; provider: string; error: unknown }
  | { stage: 'fallback_used'; provider: string }
  | { stage: 'fallback_failed'; provider: string; error: unknown };

export interface IntelligenceRouterOptions {
  /** The one real, currently-bound reasoning model. Swappable — nothing
   * outside this file's constructor depends on which provider this is. */
  primary: ModelProvider;
  /**
   * Always tried when `primary` throws or rejects. Not optional: a router
   * with no fallback is a router with a silent failure mode, and Step 3's
   * whole point is that "the model is unavailable" is an ordinary,
   * handled case, not an outage. The existing regex Classifier is wired
   * in as this fallback (see legacy-classifier-provider.ts in
   * apps/jhadina-web) rather than being the permanent intelligence layer.
   */
  fallback: ModelProvider;
  /** Optional observability hook — e.g. to append an audit event. Never
   * used to make a governance decision; the router's control flow does
   * not depend on whether this throws or what it returns. */
  onEvent?: (event: IntelligenceRouterEvent) => void;
}

/**
 * Implements `@jhadina/core-spine`'s `DecisionPort`. A future
 * `new JhadinaSpine({ ...ports, decision: intelligenceRouter })` (Phase 1
 * Step 5) is therefore a one-line wiring change, not a rewrite.
 */
export class IntelligenceRouter {
  constructor(private readonly options: IntelligenceRouterOptions) {}

  async decide(context: ContextPacket): Promise<DecisionProposal> {
    const { primary, fallback, onEvent } = this.options;

    try {
      return await primary.propose(context);
    } catch (error) {
      onEvent?.({ stage: 'primary_failed', provider: primary.name, error });
      try {
        const proposal = await fallback.propose(context);
        onEvent?.({ stage: 'fallback_used', provider: fallback.name });
        return proposal;
      } catch (fallbackError) {
        onEvent?.({ stage: 'fallback_failed', provider: fallback.name, error: fallbackError });
        // Both providers failed: fail closed. Never fabricate a proposal —
        // an absent recommendation is not license to proceed with nothing.
        throw new ModelProviderFailedError(fallback.name, fallbackError);
      }
    }
  }
}

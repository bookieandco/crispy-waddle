import type { ActionPolicy, ActionPolicyDecision, ActionRequest } from './action-executor.js';
import { SecurityCoreActionPolicy } from './security-core-action-policy.js';
import {
  JhadinaSecurityCore,
  JHADINA_DEFAULT_VALUES_CONFIGURATION,
  evaluateRiskBoundaries,
  mostRestrictiveDecision,
  type JhadinaValuesConfiguration,
  type SecurityPolicy,
} from '../../security-core/src/index.js';

/**
 * Phase 1 Step 7 — `JhadinaValuesActionPolicy`.
 *
 * Not a second policy engine: it delegates the base allow/approval/deny
 * decision to the exact same `SecurityCoreActionPolicy`/`JhadinaSecurityCore`
 * every other domain already uses, unmodified, and *combines* it with an
 * independent risk-boundary decision via "most restrictive wins" — the
 * same defense-in-depth composition pattern Money's health-gate +
 * identity-gate and Commerce's actor-capability-gate + fulfillment
 * PolicyGate already established (Architecture Checkpoint #2). Neither
 * check can loosen the other; either alone can only make the outcome
 * stricter.
 *
 * `extractRiskMetadata` is how *application code* — never the model —
 * supplies the objective facts (amount/recipient/platform) a risk
 * boundary needs. Its default extracts nothing, so a policy built with
 * no extractor behaves exactly like the base policy for every category
 * except destructive/code_evolution (which are risk-gated by capability
 * alone, needing no metadata) and financial/external_communication/
 * publishing (which then correctly fall back to `approval_required`,
 * never a silent `allow`, when their required fact is missing).
 */
export interface RiskMetadataExtractor<TAction> {
  (action: TAction): { amountMinor?: number; recipient?: string; platform?: string };
}

export class JhadinaValuesActionPolicy<TAction = unknown> implements ActionPolicy<TAction> {
  private readonly base: SecurityCoreActionPolicy<TAction>;

  constructor(
    basePolicy: SecurityPolicy,
    private readonly values: JhadinaValuesConfiguration = JHADINA_DEFAULT_VALUES_CONFIGURATION,
    private readonly extractRiskMetadata: RiskMetadataExtractor<TAction> = () => ({}),
    domain = 'jhadina-action',
  ) {
    this.base = new SecurityCoreActionPolicy<TAction>(new JhadinaSecurityCore(basePolicy), domain);
  }

  async evaluate(request: ActionRequest<TAction>): Promise<ActionPolicyDecision> {
    const baseDecision = await this.base.evaluate(request);
    const riskMetadata = this.extractRiskMetadata(request.action);
    const riskDecision = evaluateRiskBoundaries({ capability: request.type, ...riskMetadata }, this.values);
    return mostRestrictiveDecision(baseDecision, riskDecision);
  }
}

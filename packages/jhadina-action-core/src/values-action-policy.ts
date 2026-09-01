import type { ActionPolicy, ActionPolicyDecision, ActionRequest } from './action-executor.js';
import { SecurityCoreActionPolicy, type ActionRiskMetadata } from './security-core-action-policy.js';
import {
  JhadinaSecurityCore,
  JHADINA_DEFAULT_VALUES_CONFIGURATION,
  type JhadinaValuesConfiguration,
  type SecurityPolicy,
} from '../../security-core/src/index.js';

export interface RiskMetadataExtractor<TAction> {
  (action: TAction): ActionRiskMetadata;
}

/**
 * Backward-compatible ActionPolicy facade. Authorization is performed once,
 * by SecurityCoreActionPolicy -> JhadinaPolicyEngine; this class adds no
 * independent decision layer.
 */
export class JhadinaValuesActionPolicy<TAction = unknown> implements ActionPolicy<TAction> {
  private readonly policy: SecurityCoreActionPolicy<TAction>;

  constructor(
    basePolicy: SecurityPolicy,
    values: JhadinaValuesConfiguration = JHADINA_DEFAULT_VALUES_CONFIGURATION,
    extractRiskMetadata: RiskMetadataExtractor<TAction> = () => ({}),
    domain = 'jhadina-action',
  ) {
    this.policy = new SecurityCoreActionPolicy<TAction>(
      new JhadinaSecurityCore(basePolicy),
      domain,
      values,
      extractRiskMetadata,
    );
  }

  evaluate(request: ActionRequest<TAction>): Promise<ActionPolicyDecision> {
    return this.policy.evaluate(request);
  }
}

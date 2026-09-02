import type { SecurityDecision } from './security-policy.js';
import { classifyCapability } from './capability-classification.js';
import { assertValidValuesConfiguration, type JhadinaValuesConfiguration } from './values-configuration.js';

/**
 * Phase 1 Step 7 — risk boundaries.
 *
 * Turns a specific request's objective facts plus a values configuration into
 * a decision. Approval/override claims are intentionally not part of this
 * input shape.
 */
export interface RiskContext {
  capability: string;
  amountMinor?: number;
  recipient?: string;
  platform?: string;
}

function domainOf(recipient: string): string {
  const at = recipient.lastIndexOf('@');
  return at === -1 ? recipient : recipient.slice(at + 1);
}

export function evaluateRiskBoundaries(context: RiskContext, values: JhadinaValuesConfiguration): SecurityDecision {
  assertValidValuesConfiguration(values);
  const classification = classifyCapability(context.capability);
  if (!classification) return 'deny';
  if (context.capability === 'policy.self_modify') return 'deny';

  const categories = classification.categories;
  const decisions: SecurityDecision[] = [];

  if (categories.includes('code_evolution') && categories.includes('destructive')) {
    decisions.push('approval_required');
  } else if (categories.includes('code_evolution')) {
    decisions.push(values.selfModification.allowEvolutionProposals ? 'approval_required' : 'deny');
  } else if (categories.includes('destructive')) {
    decisions.push('approval_required');
  }

  if (categories.includes('financial')) {
    if (context.amountMinor === undefined) decisions.push('approval_required');
    else if (!Number.isFinite(context.amountMinor) || context.amountMinor <= 0) decisions.push('deny');
    else if (context.amountMinor > values.financial.maxAmountMinorPerAction) decisions.push('deny');
    else decisions.push('approval_required');
  }

  if (categories.includes('external_communication')) {
    if (context.recipient === undefined) decisions.push('approval_required');
    else if (values.externalCommunication.deniedRecipients.includes(context.recipient)) decisions.push('deny');
    else if (!values.externalCommunication.allowedRecipientDomains.includes(domainOf(context.recipient))) decisions.push('deny');
    else decisions.push('approval_required');
  }

  if (categories.includes('publishing')) {
    if (context.platform === undefined) decisions.push('approval_required');
    else if (!values.publishing.allowedPlatforms.includes(context.platform)) decisions.push('deny');
    else decisions.push('approval_required');
  }

  if (categories.includes('read_only') || categories.includes('reversible')) decisions.push('allow');
  if (decisions.length === 0) return 'deny';
  return decisions.reduce(mostRestrictiveDecision);
}

export function mostRestrictiveDecision(a: SecurityDecision, b: SecurityDecision): SecurityDecision {
  if (a === 'deny' || b === 'deny') return 'deny';
  if (a === 'approval_required' || b === 'approval_required') return 'approval_required';
  return 'allow';
}

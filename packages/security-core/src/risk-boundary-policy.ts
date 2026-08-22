import type { SecurityDecision } from './index.js';
import { classifyCapability } from './capability-classification.js';
import { assertValidValuesConfiguration, type JhadinaValuesConfiguration } from './values-configuration.js';

/**
 * Phase 1 Step 7 — risk boundaries.
 *
 * Turns a specific request's *objective* facts (which capability, how
 * much money, which recipient, which platform) plus a values
 * configuration into a decision. This never reads a claimed "approved"/
 * "executeNow"/"policyOverride" field — those don't exist in `RiskContext`
 * at all, so there is no field for a forged model output to smuggle
 * that authority through.
 *
 * `amountMinor`/`recipient`/`platform` must be supplied by *application
 * code* that extracted them from the real action payload — the same
 * "capability is fixed by application code, never read from the model"
 * invariant Step 5 already established, applied here to the risk
 * metadata too.
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

  // Unclassified: fail closed. A capability nobody has classified is
  // not "probably fine" — see capability-classification.ts's own header.
  if (!classification) return 'deny';

  // Hard, non-configurable floor — self-modification of Jhadina's own
  // governing policy is never auto-allowed and never merely
  // approval-gated by a value a human could loosen; it's an outright
  // deny at this layer, independent of `values.selfModification`, and
  // independent of every other category check below.
  if (context.capability === 'policy.self_modify') return 'deny';

  const categories = classification.categories;

  // A capability can belong to more than one category at once (e.g.
  // public.publish is both `publishing` and `external_communication`,
  // paid-ad.publish adds `financial` on top of both). Every applicable
  // category's own decision is computed independently below and the
  // *most restrictive one wins* — a capability is never let through
  // because only the first-checked category happened to allow it.
  const decisions: SecurityDecision[] = [];

  // code_evolution + destructive together (e.g. evolution.merge):
  // always at least approval_required, never controlled by
  // allowEvolutionProposals (that flag only concerns *proposing*).
  if (categories.includes('code_evolution') && categories.includes('destructive')) {
    decisions.push('approval_required');
  } else if (categories.includes('code_evolution')) {
    decisions.push(values.selfModification.allowEvolutionProposals ? 'approval_required' : 'deny');
  } else if (categories.includes('destructive')) {
    decisions.push('approval_required');
  }

  if (categories.includes('financial')) {
    if (context.amountMinor === undefined) {
      decisions.push('approval_required'); // unknown amount: never silently allow
    } else if (!Number.isFinite(context.amountMinor) || context.amountMinor <= 0) {
      decisions.push('deny');
    } else if (context.amountMinor > values.financial.maxAmountMinorPerAction) {
      decisions.push('deny');
    } else {
      decisions.push('approval_required'); // within the configured limit — still real money, still a human's call
    }
  }

  if (categories.includes('external_communication')) {
    if (context.recipient === undefined) {
      decisions.push('approval_required');
    } else if (values.externalCommunication.deniedRecipients.includes(context.recipient)) {
      decisions.push('deny');
    } else if (!values.externalCommunication.allowedRecipientDomains.includes(domainOf(context.recipient))) {
      decisions.push('deny');
    } else {
      decisions.push('approval_required');
    }
  }

  if (categories.includes('publishing')) {
    if (context.platform === undefined) {
      decisions.push('approval_required');
    } else if (!values.publishing.allowedPlatforms.includes(context.platform)) {
      decisions.push('deny');
    } else {
      decisions.push('approval_required');
    }
  }

  if (categories.includes('read_only') || categories.includes('reversible')) {
    decisions.push('allow');
  }

  // Every CapabilityRiskCategory is handled above; a classified
  // capability always produces at least one decision. If somehow none
  // did (a new category added without updating this function), fail
  // closed rather than defaulting to allow.
  if (decisions.length === 0) return 'deny';

  return decisions.reduce(mostRestrictiveDecision);
}

export function mostRestrictiveDecision(a: SecurityDecision, b: SecurityDecision): SecurityDecision {
  if (a === 'deny' || b === 'deny') return 'deny';
  if (a === 'approval_required' || b === 'approval_required') return 'approval_required';
  return 'allow';
}

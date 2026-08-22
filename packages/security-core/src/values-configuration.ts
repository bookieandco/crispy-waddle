/**
 * Phase 1 Step 7 — User Values, stored as governed configuration.
 *
 * This is data, not code the model can influence. `JhadinaValuesConfiguration`
 * is what a human explicitly sets (spending limits, allowed recipients,
 * allowed publishing platforms, whether Jhadina may even *propose*
 * build tasks) — an LLM never gets to author or infer one of these. The
 * default below is deliberately maximally restrictive (zero spend, zero
 * allowed recipients/platforms) so that the absence of an explicit human
 * decision reads as "nothing is authorized yet," never as "probably
 * fine." `updatedBy` exists specifically so a durable configuration can
 * never claim to have been set by "jhadina"/"system"/"model" — every real
 * change must be attributable to a real human actor id.
 *
 * This is a real, versioned, in-code default for this milestone — the
 * same pattern `JHADINA_BASE_SECURITY_POLICY` already uses. A durable,
 * human-editable-without-a-deploy backing (e.g. Supabase-stored,
 * mirroring Step 2's Memory Core migration) is real future work, not
 * fabricated here since no such migration exists yet for this data.
 */

export interface FinancialLimits {
  currency: string;
  /** Zero means no financial action is authorized at all. */
  maxAmountMinorPerAction: number;
  maxAmountMinorPerDay: number;
}

export interface ExternalCommunicationRestrictions {
  /** Empty means no external recipient is authorized yet. */
  allowedRecipientDomains: readonly string[];
  deniedRecipients: readonly string[];
}

export interface PublishingRestrictions {
  /** Empty means no publishing platform is authorized yet. */
  allowedPlatforms: readonly string[];
}

export interface SelfModificationRestrictions {
  /** Whether Jhadina may *propose* a build/change task (Step 9) for human
   * review. This never authorizes merging or executing a change — see
   * risk-boundary-policy.ts's hard floor on evolution.merge/policy.self_modify,
   * which this flag cannot override. */
  allowEvolutionProposals: boolean;
}

export interface JhadinaValuesConfiguration {
  version: number;
  updatedAt: string;
  /** A real human actor id. Never "jhadina", "system", "model", or empty. */
  updatedBy: string;
  financial: FinancialLimits;
  externalCommunication: ExternalCommunicationRestrictions;
  publishing: PublishingRestrictions;
  selfModification: SelfModificationRestrictions;
}

export const JHADINA_DEFAULT_VALUES_CONFIGURATION: JhadinaValuesConfiguration = Object.freeze({
  version: 1,
  updatedAt: '2026-08-22T00:00:00.000Z',
  updatedBy: 'system-default',
  financial: Object.freeze({ currency: 'USD', maxAmountMinorPerAction: 0, maxAmountMinorPerDay: 0 }),
  externalCommunication: Object.freeze({ allowedRecipientDomains: [], deniedRecipients: [] }),
  publishing: Object.freeze({ allowedPlatforms: [] }),
  selfModification: Object.freeze({ allowEvolutionProposals: true }),
});

export class InvalidValuesConfigurationError extends Error {
  constructor(reason: string) {
    super(`INVALID_VALUES_CONFIGURATION:${reason}`);
    this.name = 'InvalidValuesConfigurationError';
  }
}

/**
 * Validates a values configuration eagerly, at construction/load time —
 * a malformed policy fails loudly here rather than misbehaving silently
 * later inside a risk-boundary check.
 */
export function assertValidValuesConfiguration(values: JhadinaValuesConfiguration): void {
  if (!values.updatedBy || ['jhadina', 'system', 'model', 'assistant', 'ai'].includes(values.updatedBy.toLowerCase())) {
    throw new InvalidValuesConfigurationError('updatedBy_must_be_a_real_human_actor');
  }
  if (!Number.isFinite(values.financial.maxAmountMinorPerAction) || values.financial.maxAmountMinorPerAction < 0) {
    throw new InvalidValuesConfigurationError('financial.maxAmountMinorPerAction_must_be_a_nonnegative_number');
  }
  if (!Number.isFinite(values.financial.maxAmountMinorPerDay) || values.financial.maxAmountMinorPerDay < 0) {
    throw new InvalidValuesConfigurationError('financial.maxAmountMinorPerDay_must_be_a_nonnegative_number');
  }
  if (values.financial.maxAmountMinorPerAction > values.financial.maxAmountMinorPerDay && values.financial.maxAmountMinorPerDay > 0) {
    throw new InvalidValuesConfigurationError('financial.maxAmountMinorPerAction_cannot_exceed_maxAmountMinorPerDay');
  }
  if (!Array.isArray(values.externalCommunication.allowedRecipientDomains) || !Array.isArray(values.externalCommunication.deniedRecipients)) {
    throw new InvalidValuesConfigurationError('externalCommunication_lists_must_be_arrays');
  }
  if (!Array.isArray(values.publishing.allowedPlatforms)) {
    throw new InvalidValuesConfigurationError('publishing.allowedPlatforms_must_be_an_array');
  }
}

import type { DealPrecheck, RightsRecord } from './domain.js';

export type JuggernautAction =
  | 'research'
  | 'score'
  | 'prepare_asset'
  | 'schedule_approved_content'
  | 'analyze'
  | 'organize_fans'
  | 'draft_outreach'
  | 'run_preapproved_test'
  | 'public_publish'
  | 'paid_publish'
  | 'personal_fan_message'
  | 'contract_sign'
  | 'rights_grant'
  | 'venue_commitment'
  | 'budget_increase';

export interface AutonomyDecision {
  action: JuggernautAction;
  allowedWithoutApproval: boolean;
  requiredCapability?: 'public.publish'|'paid-ad.publish'|'consequential.outreach'|'contract.execute'|'rights.grant'|'financial.commitment';
  reasons: readonly string[];
}

type AutonomousJuggernautAction = Extract<JuggernautAction,
  'research'|'score'|'prepare_asset'|'schedule_approved_content'|'analyze'|'organize_fans'|'draft_outreach'|'run_preapproved_test'
>;

const AUTONOMOUS = new Set<AutonomousJuggernautAction>([
  'research',
  'score',
  'prepare_asset',
  'schedule_approved_content',
  'analyze',
  'organize_fans',
  'draft_outreach',
  'run_preapproved_test',
]);

export function decideJuggernautAutonomy(action: JuggernautAction): AutonomyDecision {
  if (isAutonomousAction(action)) {
    return Object.freeze({action, allowedWithoutApproval: true, reasons: Object.freeze(['Action is preparatory, analytical, or already bounded by prior authorization.'])});
  }
  const capability = capabilityFor(action);
  return Object.freeze({
    action,
    allowedWithoutApproval: false,
    requiredCapability: capability,
    reasons: Object.freeze(['External, financial, contractual, rights, or human-relationship authority remains with the user.']),
  });
}

export function precheckRightsForScale(rights: RightsRecord): readonly string[] {
  const blockers: string[] = [];
  if (!rights.masterOwnershipKnown) blockers.push('Master ownership is not documented.');
  if (!rights.publishingKnown) blockers.push('Publishing ownership is not documented.');
  if (rights.sampleStatus === 'review_required') blockers.push('Sample clearance requires review.');
  if (rights.sampleStatus === 'blocked') blockers.push('Sample rights block scaling.');
  if (rights.thirdPartyUsageStatus === 'review_required') blockers.push('Third-party usage rights require review.');
  if (rights.thirdPartyUsageStatus === 'blocked') blockers.push('Third-party usage rights block scaling.');
  if (!rights.evidenceRefs.length) blockers.push('Rights evidence is missing.');
  return Object.freeze(blockers);
}

export function buildDealPrecheck(input: Omit<DealPrecheck, 'requiresAttorneyReview'|'blockers'>): DealPrecheck {
  const blockers: string[] = [];
  if (input.guaranteedCashMinor < 0 || input.optionalCashMinor < 0) throw new Error('MUSIC_JUGGERNAUT_DEAL_CASH_INVALID');
  if (!input.recoupmentKnown) blockers.push('Recoupment terms are not understood.');
  if (!input.terminationKnown) blockers.push('Termination terms are not understood.');
  if (!input.reversionKnown) blockers.push('Rights reversion terms are not understood.');
  if (input.termMonths === undefined) blockers.push('Contract term is not understood.');
  if (!input.evidenceRefs.length) blockers.push('Deal evidence is missing.');
  return Object.freeze({
    ...input,
    revenueParticipation: Object.freeze([...input.revenueParticipation]),
    requiresAttorneyReview: true,
    blockers: Object.freeze(blockers),
    evidenceRefs: Object.freeze([...new Set(input.evidenceRefs)]),
  });
}

function isAutonomousAction(action: JuggernautAction): action is AutonomousJuggernautAction {
  return AUTONOMOUS.has(action as AutonomousJuggernautAction);
}

function capabilityFor(action: Exclude<JuggernautAction, AutonomousJuggernautAction>):
  AutonomyDecision['requiredCapability'] {
  switch (action) {
    case 'public_publish': return 'public.publish';
    case 'paid_publish': return 'paid-ad.publish';
    case 'personal_fan_message': return 'consequential.outreach';
    case 'contract_sign': return 'contract.execute';
    case 'rights_grant': return 'rights.grant';
    case 'venue_commitment':
    case 'budget_increase':
      return 'financial.commitment';
  }
}

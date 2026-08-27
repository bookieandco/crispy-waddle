import type { OpportunityDisposition, OpportunityScore, SamOpportunity } from './sam-types';
import type { OpportunityEconomics } from './economics';

export type MoneyAction =
  | 'BID_NOW'
  | 'FIND_PARTNER'
  | 'CONTACT_AGENCY'
  | 'RESPOND_SOURCES_SOUGHT'
  | 'MONITOR'
  | 'PASS';

export interface MoneyActionItem {
  opportunityId: string;
  action: MoneyAction;
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  deadline?: string;
  estimatedValue: number;
  estimatedMarginPercent: number;
  capabilityGap: boolean;
  rationale: string[];
}

const daysUntil = (date?: string) => {
  if (!date) return Number.POSITIVE_INFINITY;
  const ms = Date.parse(date) - Date.now();
  return Math.ceil(ms / 86_400_000);
};

export function buildMoneyAction(
  opportunity: SamOpportunity,
  score: OpportunityScore,
  economics: OpportunityEconomics,
  options: { capabilityGap?: boolean } = {},
): MoneyActionItem {
  const capabilityGap = options.capabilityGap ?? false;
  const days = daysUntil(opportunity.responseDeadline);
  const rationale = [...score.reasons, ...economics.reasons];
  let action: MoneyAction;
  let priority: MoneyActionItem['priority'];

  if (!economics.viable || score.disposition === 'PASS') {
    action = 'PASS';
    priority = 'LOW';
    rationale.push('Economics or opportunity score does not meet the current pursuit threshold.');
  } else if (opportunity.noticeType === 'SOURCES_SOUGHT') {
    action = 'RESPOND_SOURCES_SOUGHT';
    priority = days <= 7 ? 'URGENT' : 'NORMAL';
    rationale.push('Use the market-research response to establish capability and influence the eventual procurement path.');
  } else if (capabilityGap || score.disposition === 'PARTNER') {
    action = 'FIND_PARTNER';
    priority = days <= 7 ? 'URGENT' : 'HIGH';
    rationale.push('A capability gap or partner-fit signal requires partner discovery before pursuit.');
  } else if (score.disposition === 'PURSUE') {
    action = 'BID_NOW';
    priority = days <= 3 ? 'URGENT' : days <= 14 ? 'HIGH' : 'NORMAL';
    rationale.push('Opportunity is scored for active pursuit and has positive modeled economics.');
  } else if (score.disposition === 'MONITOR') {
    action = 'MONITOR';
    priority = 'LOW';
    rationale.push('Keep the opportunity visible until stronger pursuit signals appear.');
  } else {
    action = 'CONTACT_AGENCY';
    priority = 'NORMAL';
    rationale.push('Agency contact is the next information-gathering step.');
  }

  return {
    opportunityId: opportunity.noticeId,
    action,
    priority,
    deadline: opportunity.responseDeadline,
    estimatedValue: economics.awardValue,
    estimatedMarginPercent: economics.estimatedMarginPercent,
    capabilityGap,
    rationale,
  };
}

export function buildMoneyActionQueue(
  opportunities: Array<{ opportunity: SamOpportunity; score: OpportunityScore; economics: OpportunityEconomics; capabilityGap?: boolean }>,
): MoneyActionItem[] {
  const rank: Record<MoneyActionItem['priority'], number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
  return opportunities
    .map(({ opportunity, score, economics, capabilityGap }) =>
      buildMoneyAction(opportunity, score, economics, { capabilityGap }),
    )
    .sort((a, b) => rank[a.priority] - rank[b.priority] || b.estimatedValue - a.estimatedValue);
}

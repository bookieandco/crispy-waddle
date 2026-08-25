import type { AllocationRecommendation } from './allocation-engine';
import type { LiquidityRecommendation } from './liquidity-engine';
import type { OpportunityScore } from './opportunity-engine';
import type { RiskAssessment } from './risk-engine';

export type CapitalAlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type CapitalAlert = {
  id: string;
  severity: CapitalAlertSeverity;
  title: string;
  message: string;
  recommendedAction: string;
  requiresHumanApproval: boolean;
  expiresAt?: string;
};

export type GatedDecisionInput = {
  opportunity: OpportunityScore;
  allocation: AllocationRecommendation;
  risk: RiskAssessment;
};

export function buildCapitalDecisionCenter(
  opportunities: OpportunityScore[],
  allocations: AllocationRecommendation[],
  liquidity: LiquidityRecommendation,
  risks: RiskAssessment[] = [],
): CapitalAlert[] {
  const alerts: CapitalAlert[] = [];

  if (liquidity.action === 'withdraw' && liquidity.amount > 0) {
    alerts.push({ id: 'liquidity-protection', severity: 'critical', title: 'Protect operating liquidity', message: `Cash is below the configured safety target by approximately ${liquidity.amount}.`, recommendedAction: `Review a withdrawal of up to ${liquidity.amount} from liquid investments.`, requiresHumanApproval: true });
  } else if (liquidity.action === 'deposit' && liquidity.amount > 0) {
    alerts.push({ id: 'excess-cash', severity: 'medium', title: 'Excess liquidity detected', message: `Approximately ${liquidity.amount} may be deployable after configured reserves.`, recommendedAction: `Review depositing/deploying up to ${liquidity.amount}.`, requiresHumanApproval: true });
  }

  opportunities.slice(0, 5).forEach((opportunity) => {
    const allocation = allocations.find((item) => item.opportunityId === opportunity.id);
    const risk = risks.find((item) => item.opportunityId === opportunity.id);
    // Hard gate: a CONSIDER alert requires both risk approval and positive allocation.
    if (opportunity.action === 'consider' && allocation?.riskAllowed !== false && risk?.allowed !== false && allocation && allocation.recommendedAmount > 0) {
      alerts.push({
        id: `opportunity-${opportunity.id}`,
        severity: opportunity.confidence >= 0.8 ? 'high' : 'medium',
        title: `${opportunity.domain}: ${opportunity.instrument}`,
        message: `Positive risk-adjusted opportunity with confidence ${(opportunity.confidence * 100).toFixed(0)}%. Exposure gate passed.`,
        recommendedAction: `Consider allocating up to ${allocation.recommendedAmount}.`,
        requiresHumanApproval: true,
        expiresAt: opportunity.expiresAt,
      });
    }
  });

  return alerts.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

function severityRank(severity: CapitalAlertSeverity): number {
  return { critical: 5, high: 4, medium: 3, low: 2, info: 1 }[severity];
}

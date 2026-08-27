import type { SamOpportunity, OpportunityDisposition, OpportunityScore } from './sam-types';
import { analyzeSamPartnerGap, type SamPartnerProfile } from './sam-partner';

export interface SamDecision {
  opportunity: SamOpportunity;
  score: OpportunityScore;
  partnerPlan: ReturnType<typeof analyzeSamPartnerGap>;
  economics: {
    estimatedValue: number | null;
    targetGrossMargin: number;
    estimatedGrossProfit: number | null;
  };
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function daysUntil(deadline?: string) {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return ms / 86_400_000;
}

export function decideSamOpportunity(
  opportunity: SamOpportunity,
  profile: SamPartnerProfile,
): SamDecision {
  const partnerPlan = analyzeSamPartnerGap(opportunity, profile);
  const description = `${opportunity.title} ${opportunity.description ?? ''}`.toLowerCase();
  const capability = partnerPlan.gaps.some((g) => g.kind === 'CAPABILITY') ? 35 : 90;
  const naics = partnerPlan.gaps.some((g) => g.kind === 'NAICS') ? 45 : 90;
  const execution = partnerPlan.gaps.some((g) => g.kind === 'SCALE') ? 45 : 85;
  const special = partnerPlan.gaps.some((g) => g.kind === 'SPECIAL_REQUIREMENT') ? 60 : 90;
  const timingDays = daysUntil(opportunity.responseDeadline);
  const timing = timingDays == null ? 60 : timingDays < 0 ? 0 : timingDays < 7 ? 35 : timingDays < 14 ? 55 : 90;
  const value = opportunity.estimatedValue == null
    ? 50
    : opportunity.estimatedValue >= 1_000_000
      ? 100
      : opportunity.estimatedValue >= 250_000
        ? 85
        : opportunity.estimatedValue >= 50_000
          ? 70
          : 50;
  const competition = opportunity.setAside ? 75 : 55;
  const partnerFit = partnerPlan.needed ? 65 : 90;
  const total = Math.round(
    capability * 0.22 + timing * 0.15 + value * 0.18 + competition * 0.10 + execution * 0.15 + partnerFit * 0.20,
  );

  const reasons: string[] = [];
  if (capability < 70) reasons.push('Direct capability gap detected.');
  if (timing < 70) reasons.push('Deadline is tight or missing.');
  if (value >= 85) reasons.push('Contract value is large enough to justify deeper pursuit.');
  if (opportunity.setAside) reasons.push(`Set-aside signal: ${opportunity.setAside}.`);
  if (partnerPlan.needed) reasons.push(`Partner path: ${partnerPlan.dealModel}.`);
  if (description.includes('sources sought')) reasons.push('Early market-research notice; treat as pipeline development, not a guaranteed sale.');

  let disposition: OpportunityDisposition;
  if (timingDays != null && timingDays < 0) disposition = 'PASS';
  else if (total >= 78 && !partnerPlan.needed) disposition = 'PURSUE';
  else if (total >= 68 && partnerPlan.needed) disposition = 'PARTNER';
  else if (total >= 50) disposition = 'MONITOR';
  else disposition = 'PASS';

  const estimatedValue = opportunity.estimatedValue ?? null;
  const targetGrossMargin = partnerPlan.needed ? 0.20 : 0.35;

  return {
    opportunity,
    score: {
      capability: clamp(capability),
      timing: clamp(timing),
      value: clamp(value),
      competition: clamp(competition),
      execution: clamp(execution),
      partnerFit: clamp(partnerFit),
      total: clamp(total),
      disposition,
      reasons,
    },
    partnerPlan,
    economics: {
      estimatedValue,
      targetGrossMargin,
      estimatedGrossProfit: estimatedValue == null ? null : Math.round(estimatedValue * targetGrossMargin),
    },
  };
}

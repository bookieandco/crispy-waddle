import type { OpportunityDisposition, OpportunityScore, SamOpportunity } from './sam-types';

export interface SamRankingProfile {
  capabilities?: string[];
  preferredNaics?: string[];
  preferredSetAsides?: string[];
  maxDaysToDeadline?: number;
  minEstimatedValue?: number;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Deterministic first-pass ranking. LLMs may enrich reasons later, but do not decide disposition. */
export function rankSamOpportunity(
  opportunity: SamOpportunity,
  profile: SamRankingProfile = {},
): OpportunityScore {
  const capability = profile.capabilities?.length && opportunity.description
    ? clamp(profile.capabilities.filter((c) => opportunity.description!.toLowerCase().includes(c.toLowerCase())).length / profile.capabilities.length * 100)
    : 50;

  const timing = opportunity.responseDeadline
    ? clamp(100 - Math.max(0, (new Date(opportunity.responseDeadline).getTime() - Date.now()) / 86400000 < 0 ? 100 : 50))
    : 40;

  const value = opportunity.estimatedValue == null
    ? 40
    : clamp(Math.log10(Math.max(1, opportunity.estimatedValue)) / 7 * 100);

  const competition = opportunity.setAside
    ? (profile.preferredSetAsides?.some((s) => opportunity.setAside?.toLowerCase().includes(s.toLowerCase())) ? 90 : 65)
    : 45;

  const execution = opportunity.noticeType === 'SOLICITATION' ? 80 : opportunity.noticeType === 'SOURCES_SOUGHT' ? 55 : 45;
  const partnerFit = opportunity.noticeType === 'SOLICITATION' && capability < 60 ? 75 : 45;
  const total = clamp(capability * 0.25 + timing * 0.10 + value * 0.20 + competition * 0.15 + execution * 0.20 + partnerFit * 0.10);

  let disposition: OpportunityDisposition = 'PASS';
  if (total >= 75 && capability >= 55) disposition = 'PURSUE';
  else if (total >= 60) disposition = capability < 55 ? 'PARTNER' : 'MONITOR';
  else if (total >= 45) disposition = 'MONITOR';

  const reasons = [
    `Score ${total}/100`,
    opportunity.noticeType === 'SOURCES_SOUGHT' ? 'Market research: not an award by itself.' : 'Active/other notice type requires opportunity-specific review.',
    opportunity.setAside ? `Set-aside signal: ${opportunity.setAside}` : 'No set-aside identified.',
    capability < 55 ? 'Capability evidence is incomplete; consider a partner.' : 'Initial capability fit is acceptable.',
  ];

  return { capability, timing, value, competition, execution, partnerFit, total, disposition, reasons };
}

export function rankSamOpportunities(
  opportunities: SamOpportunity[],
  profile: SamRankingProfile = {},
) {
  return opportunities
    .map((opportunity) => ({ opportunity, score: rankSamOpportunity(opportunity, profile) }))
    .sort((a, b) => b.score.total - a.score.total);
}

import type { SamOpportunity, OpportunityScore, OpportunityDisposition } from './sam-types';

export interface SamScoringProfile {
  capabilities: string[];
  preferredNaics?: string[];
  maxExecutionDays?: number;
  minOpportunityValue?: number;
  maxOpportunityValue?: number;
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function textIncludesAny(text: string, terms: string[]): boolean {
  const haystack = text.toLowerCase();
  return terms.some((term) => haystack.includes(term.toLowerCase()));
}

function scoreCapability(opportunity: SamOpportunity, profile: SamScoringProfile): { score: number; reason: string } {
  const text = `${opportunity.title} ${opportunity.description ?? ''}`;
  if (!profile.capabilities.length) return { score: 50, reason: 'no capability profile configured' };
  const matches = profile.capabilities.filter((capability) => textIncludesAny(text, [capability])).length;
  const naicsMatch = opportunity.naics && profile.preferredNaics?.includes(opportunity.naics);
  if (naicsMatch) return { score: 100, reason: 'preferred NAICS match' };
  if (matches > 0) return { score: clamp(60 + matches * 15), reason: `${matches} capability match${matches === 1 ? '' : 'es'}` };
  return { score: 20, reason: 'no direct capability match' };
}

function scoreTiming(opportunity: SamOpportunity, profile: SamScoringProfile): { score: number; reason: string } {
  if (!opportunity.responseDeadline) return { score: 50, reason: 'deadline unavailable' };
  const days = (new Date(opportunity.responseDeadline).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return { score: 0, reason: 'response deadline has passed' };
  if (profile.maxExecutionDays && days < profile.maxExecutionDays) return { score: 35, reason: `only ${Math.max(0, Math.floor(days))} days until deadline` };
  if (days <= 7) return { score: 45, reason: 'deadline within 7 days' };
  if (days <= 21) return { score: 75, reason: 'deadline within 21 days' };
  return { score: 95, reason: 'healthy response window' };
}

function scoreValue(opportunity: SamOpportunity, profile: SamScoringProfile): { score: number; reason: string } {
  if (opportunity.estimatedValue == null) return { score: 50, reason: 'value unavailable' };
  const value = opportunity.estimatedValue;
  if (profile.minOpportunityValue != null && value < profile.minOpportunityValue) return { score: 25, reason: 'below preferred value floor' };
  if (profile.maxOpportunityValue != null && value > profile.maxOpportunityValue) return { score: 45, reason: 'above preferred execution range' };
  if (value >= 1_000_000) return { score: 100, reason: 'high-value opportunity' };
  if (value >= 250_000) return { score: 85, reason: 'strong contract value' };
  if (value >= 50_000) return { score: 70, reason: 'meaningful contract value' };
  return { score: 50, reason: 'smaller contract value' };
}

function scoreCompetition(opportunity: SamOpportunity): { score: number; reason: string } {
  const setAside = (opportunity.setAside ?? '').toLowerCase();
  if (setAside.includes('8(a)') || setAside.includes('hubzone') || setAside.includes('woman') || setAside.includes('veteran')) {
    return { score: 90, reason: 'small-business set-aside signal' };
  }
  if (setAside.includes('small business')) return { score: 80, reason: 'small-business set-aside' };
  if (opportunity.noticeType === 'SOURCES_SOUGHT') return { score: 65, reason: 'market-research opportunity; competition not yet defined' };
  return { score: 45, reason: 'competition level not established' };
}

function scoreExecution(opportunity: SamOpportunity): { score: number; reason: string } {
  const text = `${opportunity.title} ${opportunity.description ?? ''}`.toLowerCase();
  const complexitySignals = ['construction', 'aircraft', 'weapon', 'classified', 'nuclear', 'large-scale infrastructure'];
  if (textIncludesAny(text, complexitySignals)) return { score: 25, reason: 'high execution complexity signal' };
  if (!opportunity.description) return { score: 50, reason: 'insufficient description for execution assessment' };
  return { score: 70, reason: 'no major execution blocker detected from notice text' };
}

function scorePartnerFit(opportunity: SamOpportunity): { score: number; reason: string } {
  if (opportunity.noticeType === 'SOURCES_SOUGHT' || opportunity.noticeType === 'PRESOLICITATION') {
    return { score: 80, reason: 'early-stage notice creates partner-building window' };
  }
  if (opportunity.setAside) return { score: 70, reason: 'set-aside may support qualified teaming' };
  return { score: 55, reason: 'partner need not yet established' };
}

export function scoreSamOpportunity(opportunity: SamOpportunity, profile: SamScoringProfile): OpportunityScore {
  const capability = scoreCapability(opportunity, profile);
  const timing = scoreTiming(opportunity, profile);
  const value = scoreValue(opportunity, profile);
  const competition = scoreCompetition(opportunity);
  const execution = scoreExecution(opportunity);
  const partnerFit = scorePartnerFit(opportunity);

  const total = Math.round(
    capability.score * 0.25 +
    timing.score * 0.15 +
    value.score * 0.20 +
    competition.score * 0.15 +
    execution.score * 0.15 +
    partnerFit.score * 0.10,
  );

  let disposition: OpportunityDisposition;
  if (timing.score === 0) disposition = 'PASS';
  else if (total >= 75 && capability.score >= 60 && execution.score >= 50) disposition = 'PURSUE';
  else if (total >= 60 && partnerFit.score >= 65) disposition = 'PARTNER';
  else if (total >= 45) disposition = 'MONITOR';
  else disposition = 'PASS';

  return {
    capability: Math.round(capability.score),
    timing: Math.round(timing.score),
    value: Math.round(value.score),
    competition: Math.round(competition.score),
    execution: Math.round(execution.score),
    partnerFit: Math.round(partnerFit.score),
    total,
    disposition,
    reasons: [
      capability.reason,
      timing.reason,
      value.reason,
      competition.reason,
      execution.reason,
      partnerFit.reason,
    ],
  };
}

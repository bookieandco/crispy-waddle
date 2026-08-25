import type { CapitalPosition, Money, Opportunity, TreasuryRecommendation } from './domain.js';

export type AllocationCandidate = {
  opportunity: Opportunity;
  availableCapital: Money;
};

function score(opportunity: Opportunity): number {
  const edge = opportunity.expectedValue ?? 0;
  return edge * opportunity.confidence * opportunity.liquidityScore * (1 - opportunity.riskScore);
}

export function rankOpportunities(opportunities: Opportunity[]): Opportunity[] {
  return [...opportunities].sort((a, b) => score(b) - score(a));
}

export function deployableCapital(positions: CapitalPosition[]): Money {
  const currencies = new Set(positions.map((position) => position.balance.currency));
  if (currencies.size > 1) throw new Error('ALLOCATOR_MULTI_CURRENCY_UNSUPPORTED');

  const currency = positions[0]?.balance.currency ?? 'USD';
  const required = positions
    .filter((position) => position.bucket === 'required' || position.bucket === 'tax_reserve' || position.bucket === 'operating_reserve')
    .reduce((sum, position) => sum + position.balance.amount, 0);
  const total = positions.reduce((sum, position) => sum + position.balance.amount, 0);
  return { amount: Math.max(0, total - required), currency };
}

export function recommendTreasury(positions: CapitalPosition[], now = new Date().toISOString()): TreasuryRecommendation[] {
  const recommendations: TreasuryRecommendation[] = [];
  for (const position of positions) {
    if (!position.target || position.balance.amount >= position.target.amount) continue;
    const deficit = position.target.amount - position.balance.amount;
    recommendations.push({
      id: `treasury-${position.bucket}-${Date.now()}`,
      kind: 'transfer',
      toBucket: position.bucket,
      amount: { amount: deficit, currency: position.balance.currency },
      rationale: `${position.bucket} is below its configured target.`,
      priority: position.bucket === 'required' || position.bucket === 'tax_reserve' ? 'required' : 'high',
      createdAt: now,
    });
  }
  return recommendations;
}

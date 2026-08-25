import type { CapitalPosition, Opportunity, TreasuryRecommendation } from './domain';

export function rankOpportunities(opportunities: Opportunity[]): Opportunity[] {
  return [...opportunities].sort((a, b) => score(b) - score(a));
}

function score(opportunity: Opportunity): number {
  return (opportunity.expectedValue ?? 0) * opportunity.confidence * opportunity.liquidityScore * (1 - opportunity.riskScore);
}

export function deployableCapital(positions: CapitalPosition[]) {
  const currencies = new Set(positions.map((p) => p.balance.currency));
  if (currencies.size > 1) throw new Error('ALLOCATOR_MULTI_CURRENCY_UNSUPPORTED');
  const currency = positions[0]?.balance.currency ?? 'USD';
  const protectedBalance = positions
    .filter((p) => p.bucket === 'required' || p.bucket === 'tax_reserve' || p.bucket === 'operating_reserve')
    .reduce((sum, p) => sum + p.balance.amount, 0);
  const total = positions.reduce((sum, p) => sum + p.balance.amount, 0);
  return { amount: Math.max(0, total - protectedBalance), currency };
}

export function recommendTreasury(positions: CapitalPosition[], now = new Date().toISOString()): TreasuryRecommendation[] {
  return positions.flatMap((position) => {
    if (!position.target || position.balance.amount >= position.target.amount) return [];
    const deficit = position.target.amount - position.balance.amount;
    return [{
      id: `treasury-${position.bucket}-${Date.now()}`,
      kind: 'transfer' as const,
      toBucket: position.bucket,
      amount: { amount: deficit, currency: position.balance.currency },
      rationale: `${position.bucket} is below its configured target.`,
      priority: position.bucket === 'required' || position.bucket === 'tax_reserve' ? 'required' as const : 'high' as const,
      createdAt: now,
    }];
  });
}

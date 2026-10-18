/**
 * JH-ZERO-RIG.05: x402-style paid intelligence service feasibility, OFFLINE ONLY.
 * This is NOT an x402 implementation, checkout, wallet, HTTP endpoint or payment quote.
 * All prices are hypothetical USD cents; no token/USDC parity is assumed.
 */
export type ZeroRigServiceIdea = {
  id: string
  title: string
  publicDataOnly: boolean
  rightsCleared: boolean
  containsPrivateData: boolean
  proposedPriceCents: number | null
  inferenceCentsPerCall: number | null
  hostingCentsPerCall: number | null
  platformAndSettlementCentsPerCall: number | null
  fixedDailyHostingCents: number | null
  estimatedDailyCalls: number | null
  costEvidenceRefs: readonly string[]
  demandEvidenceRefs: readonly string[]
  estimateObservedAt: string | null
  limitCallsPerDay: number
}
export type ZeroRigServiceAssessment = {
  id: string
  verdict: 'research_only' | 'blocked' | 'insufficient_data'
  grossCentsPerDay: number | null
  netCentsPerDay: number | null
  netCentsPerCallBeforeFixed: number | null
  breakEvenDailyCalls: number | null
  reasons: string[]
  sandboxOnly: true
  providerConnected: false
  paidEndpointPublished: false
  customerPaymentsEnabled: false
  expenditureAuthorized: false
}
const cents = (v: number | null): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const dailyCalls = (v: number | null): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0

export function assessZeroRigServiceSandbox(idea: ZeroRigServiceIdea, now: string): ZeroRigServiceAssessment {
  const reasons: string[] = []
  if (!idea.id.trim() || !idea.title.trim()) throw new Error('ZERO_RIG_SERVICE_IDENTITY_REQUIRED')
  const observed = idea.estimateObservedAt ? Date.parse(idea.estimateObservedAt) : NaN
  const current = Date.parse(now)
  if (!Number.isFinite(current) || !Number.isFinite(observed) ||
      observed > current || current - observed > 24 * 3600000) reasons.push('UNVERIFIED_OR_STALE_PRICING')
  if (!idea.publicDataOnly || !idea.rightsCleared || idea.containsPrivateData) reasons.push('RIGHTS_OR_PRIVACY_NOT_CLEARED')
  if (!idea.costEvidenceRefs.length || idea.costEvidenceRefs.some(x => !x.trim())) reasons.push('COST_PROVENANCE_MISSING')
  if (!idea.demandEvidenceRefs.length || idea.demandEvidenceRefs.some(x => !x.trim())) reasons.push('CUSTOMER_DEMAND_UNVERIFIED')
  if (![idea.proposedPriceCents, idea.inferenceCentsPerCall, idea.hostingCentsPerCall,
    idea.platformAndSettlementCentsPerCall, idea.fixedDailyHostingCents].every(cents) ||
    !dailyCalls(idea.estimatedDailyCalls)) reasons.push('INCOMPLETE_UNIT_COST_MODEL')
  if (!Number.isSafeInteger(idea.limitCallsPerDay) || idea.limitCallsPerDay < 1 || idea.limitCallsPerDay > 10000) {
    reasons.push('INVALID_RATE_LIMIT')
  }
  if (dailyCalls(idea.estimatedDailyCalls) && idea.estimatedDailyCalls > idea.limitCallsPerDay) reasons.push('DEMAND_EXCEEDS_RATE_CAP')
  const blocked = reasons.includes('RIGHTS_OR_PRIVACY_NOT_CLEARED') || reasons.includes('INVALID_RATE_LIMIT')
  if (reasons.length) return {
    id: idea.id, verdict: blocked ? 'blocked' : 'insufficient_data',
    grossCentsPerDay: null, netCentsPerDay: null, netCentsPerCallBeforeFixed: null,
    breakEvenDailyCalls: null, reasons,
    sandboxOnly: true, providerConnected: false, paidEndpointPublished: false,
    customerPaymentsEnabled: false, expenditureAuthorized: false,
  }
  const cost = (idea.inferenceCentsPerCall as number) + (idea.hostingCentsPerCall as number) +
    (idea.platformAndSettlementCentsPerCall as number)
  const margin = (idea.proposedPriceCents as number) - cost
  const count = idea.estimatedDailyCalls as number
  const gross = (idea.proposedPriceCents as number) * count
  const net = margin * count - (idea.fixedDailyHostingCents as number)
  if (!Number.isSafeInteger(gross) || !Number.isSafeInteger(net)) throw new Error('ZERO_RIG_COST_OVERFLOW')
  const breakEven = margin > 0 ? Math.ceil((idea.fixedDailyHostingCents as number) / margin) : null
  return {
    id: idea.id, verdict: margin > 0 && net > 0 ? 'research_only' : 'blocked',
    grossCentsPerDay: gross, netCentsPerDay: net, netCentsPerCallBeforeFixed: margin,
    breakEvenDailyCalls: breakEven,
    reasons: margin > 0 && net > 0 ? ['PAPER_UNIT_ECONOMICS_POSITIVE_NOT_VALIDATED'] : ['PAPER_UNIT_ECONOMICS_NEGATIVE'],
    sandboxOnly: true, providerConnected: false, paidEndpointPublished: false,
    customerPaymentsEnabled: false, expenditureAuthorized: false,
  }
}

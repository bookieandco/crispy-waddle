export type GovernmentPriorityInput = {
  opportunityScore?: number
  amountMax?: number
  deadline?: string
  lifecycleScore?: number
  recurring?: boolean
  recompete?: boolean
  localMatch?: boolean
  providerMatchCount?: number
  brokerability?: 'restricted' | 'low' | 'medium' | 'high' | 'unknown'
  sourceConfidence?: number
  verificationScore?: number
  effortScore?: number
}

export type GovernmentPriority = {
  score: number
  tier: 'critical' | 'high' | 'medium' | 'watch'
  reasons: string[]
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))

function amountScore(amountMax?: number): number {
  if (!amountMax || amountMax <= 0) return 0
  if (amountMax >= 5_000_000) return 100
  if (amountMax >= 1_000_000) return 90
  if (amountMax >= 500_000) return 80
  if (amountMax >= 100_000) return 65
  if (amountMax >= 25_000) return 45
  return 25
}

function deadlineUrgency(deadline?: string): number {
  if (!deadline) return 0
  const days = (Date.parse(deadline) - Date.now()) / 86_400_000
  if (days < 0) return 0
  if (days <= 3) return 100
  if (days <= 7) return 90
  if (days <= 14) return 75
  if (days <= 30) return 55
  if (days <= 60) return 35
  return 15
}

function brokerabilityScore(value: GovernmentPriorityInput['brokerability']): number {
  switch (value) {
    case 'high': return 100
    case 'medium': return 75
    case 'low': return 45
    case 'restricted': return 0
    default: return 25
  }
}

export function scoreGovernmentOpportunity(input: GovernmentPriorityInput): GovernmentPriority {
  const amount = amountScore(input.amountMax)
  const deadline = deadlineUrgency(input.deadline)
  const lifecycle = clamp(input.lifecycleScore ?? 0)
  const provider = clamp((input.providerMatchCount ?? 0) * 20)
  const broker = brokerabilityScore(input.brokerability)
  const confidence = clamp(input.sourceConfidence ?? 0)
  const verification = clamp(input.verificationScore ?? 0)
  const local = input.localMatch ? 100 : 0
  const recurring = input.recurring ? 100 : 0
  const effort = clamp(input.effortScore ?? 50)

  // Deliberately deterministic: this is prioritization, not a claim that a contract
  // is winnable. Compliance and eligibility remain separate gates.
  const score = Math.round(clamp(
    (input.opportunityScore ?? 0) * 0.20 +
    amount * 0.15 +
    deadline * 0.10 +
    lifecycle * 0.15 +
    provider * 0.10 +
    broker * 0.10 +
    confidence * 0.05 +
    verification * 0.05 +
    local * 0.05 +
    recurring * 0.03 +
    (100 - effort) * 0.02,
  ))

  const reasons: string[] = []
  if (lifecycle >= 90) reasons.push('contract is approaching a high-value lifecycle event')
  if (amount >= 80) reasons.push('material contract value')
  if (deadline >= 75) reasons.push('deadline requires near-term action')
  if (provider >= 60) reasons.push('multiple potential fulfillment providers detected')
  if (broker >= 75) reasons.push('strong permitted-partner/brokerage potential')
  if (recurring) reasons.push('recurring demand signal')
  if (local) reasons.push('local geographic match')
  if (confidence < 60 || verification < 60) reasons.push('verification still needs strengthening')
  if (input.brokerability === 'restricted') reasons.push('brokerage/subcontracting restrictions require review')

  const tier = score >= 85 ? 'critical' : score >= 70 ? 'high' : score >= 50 ? 'medium' : 'watch'
  return { score, tier, reasons }
}

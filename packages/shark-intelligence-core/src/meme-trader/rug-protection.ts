export type RugProtectionDisposition = 'ALLOW_CANDIDATE' | 'REVIEW' | 'BLOCK'

export type RugProtectionEvidence = {
  source: string
  observedAt: string
  label: string
  value?: number | boolean | string | null
}

export type RugProtectionInput = {
  nonTransferable?: boolean
  mintAuthorityLive?: boolean
  freezeAuthorityLive?: boolean
  balanceMutable?: boolean
  top10HolderPct?: number
  lpBurnPct?: number
  lpLockedPct?: number
  liquidityDrainRate?: number
  supplyControlRisk?: number
  holderConcentrationRisk?: number
  marketIntegrityRisk?: number
  sourceDisagreement?: boolean
  evidence: RugProtectionEvidence[]
}

export type RugProtectionResult = {
  disposition: RugProtectionDisposition
  score: number
  hardBlockers: string[]
  warnings: string[]
  evidenceIds: string[]
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

/**
 * Defensive pre-trade rug guard. This is an evidence/risk layer only.
 * It never creates execution authority and must remain upstream of
 * MemeTradeAssessment -> DecisionProposal -> Policy.
 */
export function evaluateRugProtection(input: RugProtectionInput): RugProtectionResult {
  const hardBlockers: string[] = []
  const warnings: string[] = []
  let score = 0

  if (input.nonTransferable === true) {
    hardBlockers.push('token is non-transferable')
    score = 100
  }

  if (input.freezeAuthorityLive === true) {
    hardBlockers.push('freeze authority is live')
    score += 35
  }

  if (input.balanceMutable === true) {
    hardBlockers.push('token balances are mutable')
    score += 45
  }

  if (input.mintAuthorityLive === true) {
    warnings.push('mint authority is live')
    score += 25
  }

  if (finite(input.top10HolderPct)) {
    if (input.top10HolderPct > 70) {
      hardBlockers.push(`top-10 holder concentration is ${input.top10HolderPct}%`)
      score += 40
    } else if (input.top10HolderPct > 45) {
      warnings.push(`top-10 holder concentration is ${input.top10HolderPct}%`)
      score += 20
    }
  }

  if (finite(input.lpBurnPct) && input.lpBurnPct < 50) {
    warnings.push(`LP burn is only ${input.lpBurnPct}%`)
    score += 20
  }

  if (finite(input.lpLockedPct) && input.lpLockedPct < 50) {
    warnings.push(`LP lock is only ${input.lpLockedPct}%`)
    score += 15
  }

  if (finite(input.liquidityDrainRate) && input.liquidityDrainRate > 0.25) {
    hardBlockers.push(`liquidity is draining rapidly (${input.liquidityDrainRate})`)
    score += 45
  }

  if (finite(input.supplyControlRisk)) score += clamp(input.supplyControlRisk) * 0.25
  if (finite(input.holderConcentrationRisk)) score += clamp(input.holderConcentrationRisk) * 0.15
  if (finite(input.marketIntegrityRisk)) score += clamp(input.marketIntegrityRisk) * 0.15

  if (input.sourceDisagreement === true) {
    warnings.push('independent safety sources disagree')
    score += 15
  }

  score = clamp(score)

  const disposition: RugProtectionDisposition = hardBlockers.length > 0 || score >= 70
    ? 'BLOCK'
    : score >= 35 || warnings.length > 0
      ? 'REVIEW'
      : 'ALLOW_CANDIDATE'

  return {
    disposition,
    score: Number(score.toFixed(2)),
    hardBlockers,
    warnings,
    evidenceIds: input.evidence.map((e) => e.label),
  }
}

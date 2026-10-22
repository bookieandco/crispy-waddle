import type { LiquidityHistory } from './liquidity-history'
import type { LPControlRisk } from './lp-control-risk'

export type RugProtectionDisposition = 'ALLOW_CANDIDATE' | 'REVIEW' | 'BLOCK'
export type RugProtectionEvidence = { source: string; observedAt: string; label: string; value?: number | boolean | string | null }
export type RugProtectionInput = {
  nonTransferable?: boolean
  mintAuthorityLive?: boolean
  freezeAuthorityLive?: boolean
  balanceMutable?: boolean
  top10HolderPct?: number
  lpBurnPct?: number
  lpLockedPct?: number
  liquidityDrainRate?: number
  liquidityDrainAcceleration?: number
  liquidityDrawdownFromPeak?: number
  liquidityHistory?: Pick<LiquidityHistory, 'drawdownFromPeak' | 'drainRate' | 'drainAcceleration' | 'evidenceIds'>
  lpControlRiskScore?: number
  lpControlRiskBand?: LPControlRisk['band']
  lpControlRisk?: Pick<LPControlRisk, 'score' | 'band' | 'reasons' | 'evidenceIds'>
  supplyControlRisk?: number
  holderConcentrationRisk?: number
  marketIntegrityRisk?: number
  sourceDisagreement?: boolean
  evidence: RugProtectionEvidence[]
}
// Diagnoses the *mechanism indicated by evidence*, not a certain future rug.
// A capability or pattern is never mislabeled as a completed exploit.
export type RugAttackMechanism =
  | 'SELL_RESTRICTION'
  | 'FREEZE_CONTROL'
  | 'BALANCE_MUTATION'
  | 'SUPPLY_DILUTION'
  | 'LIQUIDITY_WITHDRAWAL'
  | 'LP_CONTROL'
  | 'CONCENTRATED_DUMP'
  | 'MARKET_INTEGRITY_ANOMALY'
export type RugAttackFingerprint = Readonly<{
  mechanism: RugAttackMechanism
  evidenceClass: 'CAPABILITY_PRESENT' | 'RISK_PATTERN'
  severity: 'CRITICAL' | 'ELEVATED'
  trigger: string
}>
export type RugProtectionResult = {
  disposition: RugProtectionDisposition; score: number; hardBlockers: string[]; warnings: string[]; evidenceIds: string[]
  attackFingerprints?: readonly RugAttackFingerprint[]
}
const clamp = (n: number) => Math.max(0, Math.min(100, n))
const unit = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

/** Pure, constant-work fingerprinting for the latency-critical research path. */
export function classifyRugAttackMechanisms(input: RugProtectionInput): readonly RugAttackFingerprint[] {
  const result: RugAttackFingerprint[] = []
  const add=(mechanism:RugAttackMechanism,evidenceClass:RugAttackFingerprint['evidenceClass'],severity:RugAttackFingerprint['severity'],trigger:string)=>{
    result.push(Object.freeze({mechanism,evidenceClass,severity,trigger}))
  }
  if(input.nonTransferable===true)add('SELL_RESTRICTION','CAPABILITY_PRESENT','CRITICAL','nonTransferable')
  if(input.freezeAuthorityLive===true)add('FREEZE_CONTROL','CAPABILITY_PRESENT','CRITICAL','freezeAuthorityLive')
  if(input.balanceMutable===true)add('BALANCE_MUTATION','CAPABILITY_PRESENT','CRITICAL','balanceMutable')
  if(input.mintAuthorityLive===true)add('SUPPLY_DILUTION','CAPABILITY_PRESENT','ELEVATED','mintAuthorityLive')
  const drain=input.liquidityDrainRate??input.liquidityHistory?.drainRate
  if(unit(drain)&&drain>0.1)add('LIQUIDITY_WITHDRAWAL','RISK_PATTERN',drain>0.25?'CRITICAL':'ELEVATED','liquidityDrainRate')
  const lpBand=input.lpControlRiskBand??input.lpControlRisk?.band
  if(lpBand==='critical'||lpBand==='high')add('LP_CONTROL','RISK_PATTERN',lpBand==='critical'?'CRITICAL':'ELEVATED','lpControlRiskBand')
  if(unit(input.top10HolderPct)&&input.top10HolderPct>45)add('CONCENTRATED_DUMP','RISK_PATTERN',input.top10HolderPct>70?'CRITICAL':'ELEVATED','top10HolderPct')
  if(input.sourceDisagreement===true||unit(input.marketIntegrityRisk)&&input.marketIntegrityRisk>=0.8){
    add('MARKET_INTEGRITY_ANOMALY','RISK_PATTERN','ELEVATED',input.sourceDisagreement===true?'sourceDisagreement':'marketIntegrityRisk')
  }
  return Object.freeze(result)
}

export function evaluateRugProtection(input: RugProtectionInput): RugProtectionResult {
  const hardBlockers: string[] = []
  const warnings: string[] = []
  let score = 0
  if (input.nonTransferable === true) { hardBlockers.push('token is non-transferable'); score = 100 }
  if (input.freezeAuthorityLive === true) { hardBlockers.push('freeze authority is live'); score += 35 }
  if (input.balanceMutable === true) { hardBlockers.push('token balances are mutable'); score += 45 }
  if (input.mintAuthorityLive === true) { warnings.push('mint authority is live'); score += 25 }
  if (unit(input.top10HolderPct)) {
    if (input.top10HolderPct > 70) { hardBlockers.push(`top-10 holder concentration is ${input.top10HolderPct}%`); score += 40 }
    else if (input.top10HolderPct > 45) { warnings.push(`top-10 holder concentration is ${input.top10HolderPct}%`); score += 20 }
  }
  if (unit(input.lpBurnPct) && input.lpBurnPct < 50) { warnings.push(`LP burn is only ${input.lpBurnPct}%`); score += 20 }
  if (unit(input.lpLockedPct) && input.lpLockedPct < 50) { warnings.push(`LP lock is only ${input.lpLockedPct}%`); score += 15 }

  const history = input.liquidityHistory
  const liquidityDrainRate = input.liquidityDrainRate ?? history?.drainRate
  const liquidityDrainAcceleration = input.liquidityDrainAcceleration ?? history?.drainAcceleration
  const liquidityDrawdownFromPeak = input.liquidityDrawdownFromPeak ?? history?.drawdownFromPeak
  if (unit(liquidityDrainRate)) {
    if (liquidityDrainRate > 0.25) { hardBlockers.push(`liquidity is draining rapidly (${liquidityDrainRate})`); score += 45 }
    else if (liquidityDrainRate > 0.1) { warnings.push(`liquidity drain is elevated (${liquidityDrainRate})`); score += 18 }
  }
  if (unit(liquidityDrainAcceleration) && liquidityDrainAcceleration > 0.15) { warnings.push('liquidity drain is accelerating'); score += 18 }
  if (unit(liquidityDrawdownFromPeak) && liquidityDrawdownFromPeak > 0.75) { warnings.push('liquidity has suffered a severe peak drawdown'); score += 18 }

  const lpRiskScore = input.lpControlRiskScore ?? input.lpControlRisk?.score
  const lpRiskBand = input.lpControlRiskBand ?? input.lpControlRisk?.band
  if (unit(lpRiskScore)) score += clamp(lpRiskScore * 35)
  if (lpRiskBand === 'critical') hardBlockers.push('LP control risk is critical')
  else if (lpRiskBand === 'high') warnings.push('LP control risk is high')
  if (input.lpControlRisk?.reasons?.length) warnings.push(...input.lpControlRisk.reasons.map(reason => `LP: ${reason}`))

  if (unit(input.supplyControlRisk)) score += clamp(input.supplyControlRisk) * 25
  if (unit(input.holderConcentrationRisk)) score += clamp(input.holderConcentrationRisk) * 15
  if (unit(input.marketIntegrityRisk)) score += clamp(input.marketIntegrityRisk) * 15
  if (input.sourceDisagreement === true) { warnings.push('independent safety sources disagree'); score += 15 }
  score = clamp(score)
  const disposition: RugProtectionDisposition = hardBlockers.length > 0 || score >= 70 ? 'BLOCK' : score >= 35 || warnings.length > 0 ? 'REVIEW' : 'ALLOW_CANDIDATE'
  const evidenceIds = [...new Set([
    ...input.evidence.map(e => e.label),
    ...(history?.evidenceIds ?? []),
    ...(input.lpControlRisk?.evidenceIds ?? []),
  ])]
  return { disposition, score: Number(score.toFixed(2)), hardBlockers, warnings, evidenceIds, attackFingerprints:classifyRugAttackMechanisms(input) }
}

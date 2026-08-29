import type { SharkRisk, SharkStreetSignal } from './index.js'

export type SharkSourceKind =
  | 'dex'
  | 'chain'
  | 'social'
  | 'market'
  | 'historical'
  | 'system'

export type SharkObservation = {
  id: string
  opportunityId: string
  source: SharkSourceKind
  observedAt: string
  feature:
    | 'liquidity'
    | 'holders'
    | 'contract'
    | 'sellability'
    | 'market'
    | 'wallet'
    | 'social'
    | 'migration'
  value: number
  confidence: number
  evidenceId?: string
  metadata?: Record<string, string | number | boolean | null>
}

export type SharkFusedSignal = {
  opportunityId: string
  feature: SharkObservation['feature']
  value: number
  confidence: number
  observations: string[]
  sources: SharkSourceKind[]
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))

export function fuseObservations(observations: SharkObservation[]): SharkFusedSignal[] {
  const groups = new Map<string, SharkObservation[]>()
  for (const observation of observations) {
    const key = `${observation.opportunityId}:${observation.feature}`
    const group = groups.get(key) ?? []
    group.push(observation)
    groups.set(key, group)
  }

  return [...groups.values()].map((group) => {
    const totalWeight = group.reduce((sum, item) => sum + clamp(item.confidence), 0) || 1
    const value = group.reduce((sum, item) => sum + item.value * clamp(item.confidence), 0) / totalWeight
    const confidence = clamp(totalWeight / Math.max(group.length, 1))

    return {
      opportunityId: group[0].opportunityId,
      feature: group[0].feature,
      value: clamp(value),
      confidence,
      observations: group.map((item) => item.id),
      sources: [...new Set(group.map((item) => item.source))],
    }
  })
}

export function fuseStreetSignals(signals: SharkStreetSignal[]): SharkStreetSignal[] {
  const grouped = new Map<SharkStreetSignal['name'], SharkStreetSignal[]>()
  for (const signal of signals) {
    const group = grouped.get(signal.name) ?? []
    group.push(signal)
    grouped.set(signal.name, group)
  }

  return [...grouped.entries()].map(([name, group]) => {
    const strength = group.reduce((sum, signal) => sum + clamp(signal.strength), 0) / group.length
    const negative = group.filter((signal) => signal.direction === 'negative').length
    const positive = group.filter((signal) => signal.direction === 'positive').length
    const direction = negative === positive ? 'unknown' : negative > positive ? 'negative' : 'positive'

    return {
      name,
      direction,
      strength: clamp(strength),
      rationale: group.map((signal) => signal.rationale).join(' | '),
      evidenceIds: [...new Set(group.flatMap((signal) => signal.evidenceIds))],
    }
  })
}

export function inferRiskFromObservation(observation: SharkObservation): SharkRisk | undefined {
  if (observation.feature === 'liquidity' && observation.value < 0.35) return 'liquidity'
  if (observation.feature === 'holders' && observation.value < 0.35) return 'holder_concentration'
  if (observation.feature === 'contract' && observation.value < 0.35) return 'contract_control'
  if (observation.feature === 'sellability' && observation.value < 0.35) return 'sellability'
  if (observation.feature === 'market' && observation.value < 0.35) return 'market_structure'
  if (observation.feature === 'wallet' && observation.value < 0.35) return 'wallet_behavior'
  if (observation.feature === 'social' && observation.value < 0.35) return 'social_manipulation'
  return undefined
}

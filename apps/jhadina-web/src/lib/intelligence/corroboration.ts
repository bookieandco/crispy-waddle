import type { IntelligenceDomain } from "./source-registry"

export type SignalEvidence = {
  id: string
  sourceId: string
  domain: IntelligenceDomain
  topic: string
  claim: string
  capturedAt: string
  confidence: number
}

export type CorroboratedSignal = {
  topic: string
  claim: string
  evidenceIds: string[]
  sourceCount: number
  domainCount: number
  confidence: number
  corroboration: "none" | "weak" | "moderate" | "strong"
}

/**
 * Corroboration measures independent evidence. Repeated copies of the same
 * source are not treated as independent confirmation.
 */
export function corroborate(evidence: SignalEvidence[]): CorroboratedSignal[] {
  const groups = new Map<string, SignalEvidence[]>()

  for (const item of evidence) {
    const key = `${item.topic.toLowerCase()}::${item.claim.toLowerCase()}`
    const current = groups.get(key) ?? []
    current.push(item)
    groups.set(key, current)
  }

  return [...groups.entries()].map(([key, items]) => {
    const [topic, claim] = key.split("::")
    const sourceIds = new Set(items.map((item) => item.sourceId))
    const domains = new Set(items.map((item) => item.domain))
    const averageConfidence = items.reduce((sum, item) => sum + Math.max(0, Math.min(1, item.confidence)), 0) / items.length
    const sourceBonus = Math.min(0.25, Math.max(0, sourceIds.size - 1) * 0.08)
    const domainBonus = Math.min(0.15, Math.max(0, domains.size - 1) * 0.05)
    const confidence = Math.min(1, averageConfidence + sourceBonus + domainBonus)
    const independentCount = sourceIds.size

    return {
      topic,
      claim,
      evidenceIds: items.map((item) => item.id),
      sourceCount: independentCount,
      domainCount: domains.size,
      confidence,
      corroboration: independentCount >= 4 && confidence >= 0.8
        ? "strong"
        : independentCount >= 2 && confidence >= 0.65
          ? "moderate"
          : independentCount >= 1 && confidence >= 0.45
            ? "weak"
            : "none",
    }
  })
}

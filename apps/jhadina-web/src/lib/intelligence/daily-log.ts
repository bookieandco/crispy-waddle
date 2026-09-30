import type { ChangeEvent, EvidenceItem, IntelligenceDomain } from "./source-adapter"

export type DailyLogEntry = {
  id: string
  domain: IntelligenceDomain
  type: "change" | "signal" | "risk" | "opportunity" | "follow_up"
  title: string
  summary: string
  importance: "low" | "medium" | "high" | "critical"
  confidence: "low" | "medium" | "high"
  evidenceIds: string[]
  actionRequired: boolean
}

export type DailyJhadinaLog = {
  date: string
  generatedAt: string
  entries: DailyLogEntry[]
  sourceCount: number
  evidenceCount: number
  changeCount: number
  unresolvedCount: number
}

export function synthesizeDailyLog(
  date: string,
  evidence: EvidenceItem[],
  changes: ChangeEvent[],
): DailyJhadinaLog {
  const entries: DailyLogEntry[] = changes.map((change) => ({
    id: change.id,
    domain: change.domain,
    type: "change",
    title: `${change.source} changed`,
    summary: `A monitored source changed at ${change.url}.`,
    importance: "medium",
    confidence: "high",
    evidenceIds: change.evidenceId ? [change.evidenceId] : [],
    actionRequired: true,
  }))

  return {
    date,
    generatedAt: new Date().toISOString(),
    entries,
    sourceCount: new Set(evidence.map((item) => item.source)).size,
    evidenceCount: evidence.length,
    changeCount: changes.length,
    unresolvedCount: entries.filter((entry) => entry.actionRequired).length,
  }
}

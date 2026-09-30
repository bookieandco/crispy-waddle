import type { ChangeEvent, DailyLog, IntelligenceDomain, IntelligenceSignal } from "./contracts"

export type DailyLogInput = {
  date: string
  generatedAt: string
  domains: IntelligenceDomain[]
  signals: IntelligenceSignal[]
  notableChanges: ChangeEvent[]
  sourceHealth: Record<string, "ok" | "degraded" | "blocked" | "stale">
}

const priorityRank: Record<IntelligenceSignal["priority"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

export function buildDailyLog(input: DailyLogInput): DailyLog {
  const signals = [...input.signals].sort(
    (a, b) => priorityRank[b.priority] - priorityRank[a.priority],
  )

  const unresolvedQuestions = signals
    .filter((signal) => signal.confidence !== "high")
    .slice(0, 10)
    .map((signal) => `Verify: ${signal.title}`)

  const recommendedNextSteps = signals
    .filter((signal) => signal.priority === "critical" || signal.priority === "high")
    .slice(0, 10)
    .map((signal) => `Review ${signal.domain}: ${signal.title}`)

  return {
    id: `daily-${input.date}`,
    date: input.date,
    generatedAt: input.generatedAt,
    domains: input.domains,
    signals,
    notableChanges: input.notableChanges,
    sourceHealth: input.sourceHealth,
    unresolvedQuestions,
    recommendedNextSteps,
  }
}

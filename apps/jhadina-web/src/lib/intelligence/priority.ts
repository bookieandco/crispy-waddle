import type { SourceWatch } from "./source-registry"

export type ChangePriorityInput = {
  sourceId: string
  changed: boolean
  domainImpact: number
  novelty: number
  confidence: number
  urgency: number
}

export type PrioritizedChange = ChangePriorityInput & {
  score: number
  tier: "ignore" | "review" | "important" | "critical"
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))

export function prioritizeChange(
  input: ChangePriorityInput,
  watches: SourceWatch[],
): PrioritizedChange {
  const watch = watches.find((item) => item.id === input.sourceId)
  const watchWeight = watch?.priority === "critical"
    ? 1
    : watch?.priority === "high"
      ? 0.85
      : watch?.priority === "normal"
        ? 0.65
        : 0.4

  const score = input.changed
    ? Math.round(
        100 *
          (0.25 * clamp(input.domainImpact) +
            0.2 * clamp(input.novelty) +
            0.2 * clamp(input.confidence) +
            0.2 * clamp(input.urgency) +
            0.15 * watchWeight),
      )
    : 0

  return {
    ...input,
    score,
    tier: score >= 85 ? "critical" : score >= 65 ? "important" : score >= 35 ? "review" : "ignore",
  }
}

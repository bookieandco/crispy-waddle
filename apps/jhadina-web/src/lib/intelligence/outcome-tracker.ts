export type OutcomeTarget = {
  id: string
  interventionId: string
  metric: string
  baseline: number
  target: number
  direction: "increase" | "decrease"
  targetDate: string
  sourceId: string
}

export type OutcomeObservation = {
  targetId: string
  value: number
  observedAt: string
  sourceId: string
  confidence: number
}

export type OutcomeStatus = "on_track" | "off_track" | "achieved" | "unknown"

export type OutcomeAssessment = {
  targetId: string
  status: OutcomeStatus
  baseline: number
  current: number | null
  target: number
  progress: number | null
  confidence: number
  caveats: string[]
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))

export function assessOutcome(
  target: OutcomeTarget,
  observations: OutcomeObservation[],
  now = new Date(),
): OutcomeAssessment {
  const relevant = observations
    .filter((item) => item.targetId === target.id)
    .sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime())

  const latest = relevant.at(-1)
  if (!latest) {
    return {
      targetId: target.id,
      status: "unknown",
      baseline: target.baseline,
      current: null,
      target: target.target,
      progress: null,
      confidence: 0,
      caveats: ["No post-intervention observation is available."],
    }
  }

  const denominator = Math.abs(target.target - target.baseline)
  const rawProgress = denominator === 0
    ? latest.value === target.target ? 1 : 0
    : target.direction === "decrease"
      ? (target.baseline - latest.value) / (target.baseline - target.target)
      : (latest.value - target.baseline) / (target.target - target.baseline)

  const progress = clamp(rawProgress)
  const achieved = target.direction === "decrease"
    ? latest.value <= target.target
    : latest.value >= target.target
  const pastDue = now.getTime() >= new Date(target.targetDate).getTime()

  return {
    targetId: target.id,
    status: achieved ? "achieved" : pastDue || progress < 0.5 ? "off_track" : "on_track",
    baseline: target.baseline,
    current: latest.value,
    target: target.target,
    progress,
    confidence: clamp(latest.confidence),
    caveats: [
      ...(pastDue && !achieved ? ["Target date has passed without reaching the target."] : []),
      ...(relevant.length < 2 ? ["Only one post-intervention observation is available; trend confidence is limited."] : []),
    ],
  }
}

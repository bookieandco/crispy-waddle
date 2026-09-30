export type TimePoint = {
  timestamp: string
  score: number
}

export type TemporalTrend = "new" | "accelerating" | "rising" | "stable" | "falling" | "fading"

export type TemporalSignal = {
  trend: TemporalTrend
  currentScore: number
  previousScore: number
  delta: number
  velocity: number
  observations: number
}

const clamp = (value: number) => Math.max(0, Math.min(100, value))

/** Compare recent signal strength with its prior baseline. */
export function analyzeTemporalSignal(points: TimePoint[]): TemporalSignal {
  const ordered = [...points].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  if (ordered.length === 0) {
    return { trend: "stable", currentScore: 0, previousScore: 0, delta: 0, velocity: 0, observations: 0 }
  }

  if (ordered.length === 1) {
    return {
      trend: "new",
      currentScore: clamp(ordered[0].score),
      previousScore: 0,
      delta: clamp(ordered[0].score),
      velocity: 0,
      observations: 1,
    }
  }

  const current = clamp(ordered[ordered.length - 1].score)
  const previous = clamp(ordered[ordered.length - 2].score)
  const delta = current - previous
  const velocity = delta / Math.max(
    1,
    (new Date(ordered[ordered.length - 1].timestamp).getTime() -
      new Date(ordered[ordered.length - 2].timestamp).getTime()) / 3_600_000,
  )

  const trend: TemporalTrend =
    previous === 0 && current > 0 ? "new" :
    velocity >= 15 ? "accelerating" :
    velocity >= 3 ? "rising" :
    velocity <= -15 ? "fading" :
    velocity <= -3 ? "falling" :
    "stable"

  return {
    trend,
    currentScore: current,
    previousScore: previous,
    delta,
    velocity,
    observations: ordered.length,
  }
}

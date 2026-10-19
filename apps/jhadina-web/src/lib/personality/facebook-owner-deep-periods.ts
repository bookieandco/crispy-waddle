import type { WritingSample } from "./facebook-owner-import"
import { deriveOwnerDeepWritingSignals, type DeepWritingSignal } from "./facebook-owner-deep-signals"

/**
 * FB-RELATE.DEEP.05: bounded, read-only, fixed-period numeric summaries.
 * This is sampled writing, not a population frequency or longitudinal
 * personality/behavior inference. Never expose source paths, raw dates/text,
 * user-derived lexicons, source IDs or individual observations.
 */
export type DeepPeriodId = "2010–2013" | "2014–2017" | "2018–2021" | "2022–2026" | "Other/undated"
export type DeepPeriodObservation = Readonly<{
  period: DeepPeriodId
  entries: number
  posts: number
  comments: number
  status: "enough-sampled-writing" | "insufficient-sampled-writing"
  indicators: readonly DeepWritingSignal[]
}>

const PERIODS: readonly DeepPeriodId[] = [
  "2010–2013", "2014–2017", "2018–2021", "2022–2026", "Other/undated",
]
const MIN_PERIOD_ENTRIES = 30

export function periodForOwnerWritingDate(date?: string): DeepPeriodId {
  // Do not expose a raw date in a report. Only accepted YYYY-MM pattern
  // enters the fixed period bucket.
  if (!date || !/^(20\d\d)-\d\d-\d\dT/.test(date)) return "Other/undated"
  const year = Number(date.slice(0, 4))
  if (year >= 2010 && year <= 2013) return "2010–2013"
  if (year >= 2014 && year <= 2017) return "2014–2017"
  if (year >= 2018 && year <= 2021) return "2018–2021"
  if (year >= 2022 && year <= 2026) return "2022–2026"
  return "Other/undated"
}

export function summarizeOwnerDeepWritingPeriods(samples: readonly WritingSample[]): DeepPeriodObservation[] {
  const groups = new Map<DeepPeriodId, WritingSample[]>(PERIODS.map((period) => [period, []]))
  for (const sample of samples.slice(0, 2500)) {
    groups.get(periodForOwnerWritingDate(sample.at))!.push(sample)
  }
  return PERIODS.map((period) => {
    const group = groups.get(period)!
    const posts = group.filter((s) => s.kind === "post").length
    const enough = group.length >= MIN_PERIOD_ENTRIES
    return {
      period,
      entries: group.length,
      posts,
      comments: group.length - posts,
      status: enough ? "enough-sampled-writing" as const : "insufficient-sampled-writing" as const,
      // Refuse to produce pattern-level rates for sparse periods. No
      // extrapolation, "drift" classification or cross-period ranking.
      indicators: enough ? deriveOwnerDeepWritingSignals(group) : [],
    }
  })
}

export type PollRecord = {
  id: string
  pollster: string
  fieldStart: string
  fieldEnd: string
  geography: string
  sampleSize: number
  population: "likely_voters" | "registered_voters" | "adults" | "unknown"
  marginOfError?: number
  candidate?: string
  support?: number
  sourceUrl: string
}

export type PollTrend = {
  geography: string
  candidate: string
  averageSupport: number | null
  pollCount: number
  confidence: "low" | "medium" | "high"
  direction: "up" | "down" | "stable" | "insufficient_data"
  warning?: string
}

/** Descriptive only. Structural validation does not authenticate a poll. */
export function summarizePolls(
  polls: PollRecord[], candidate: string, geography: string,
  asOf = new Date().toISOString().slice(0, 10),
): PollTrend {
  const warnings = ["Descriptive sample-weighted average, not a forecast or statistical confidence estimate. Source authenticity and methodology require review."]
  const empty = (): PollTrend => ({ geography, candidate, averageSupport: null, pollCount: 0,
    confidence: "low", direction: "insufficient_data", warning: warnings.join(" ") })
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  if (!validDate(asOf)) { warnings.push("Invalid observation date."); return empty() }
  const seenIds = new Set<string>()
  const seenSources = new Set<string>()
  const relevant = polls.filter((p) => p.candidate === candidate && p.geography === geography)
  const admitted = relevant.filter((p) => {
    let url: URL
    try { url = new URL(p.sourceUrl) } catch { return false }
    if (url.protocol !== "https:" || url.username || url.password ||
      /(^|\.)example\.(com|org|net)$/.test(url.hostname)) return false
    if (!p.id.trim() || !p.pollster.trim() || !Number.isFinite(p.support) || p.support! < 0 || p.support! > 100 ||
      !Number.isSafeInteger(p.sampleSize) || p.sampleSize <= 0 ||
      !["likely_voters", "registered_voters", "adults"].includes(p.population) ||
      !validDate(p.fieldStart) || !validDate(p.fieldEnd) || p.fieldStart > p.fieldEnd || p.fieldEnd > asOf ||
      (p.marginOfError !== undefined && (!Number.isFinite(p.marginOfError) || p.marginOfError < 0 || p.marginOfError > 100))) return false
    url.hash = ""
    const sourceKey = [url.href, p.fieldStart, p.fieldEnd, p.population].join("|")
    if (seenIds.has(p.id) || seenSources.has(sourceKey)) return false
    seenIds.add(p.id); seenSources.add(sourceKey)
    return true
  })
  if (admitted.length !== relevant.length) warnings.push(`${relevant.length - admitted.length} invalid or duplicate observations excluded.`)
  if (!admitted.length) { warnings.push("No usable observations supplied."); return empty() }
  if (new Set(admitted.map(p => p.population)).size > 1) {
    warnings.push("Different surveyed populations cannot be pooled; select one population.")
    return empty()
  }
  const sorted = [...admitted].sort((a, b) => a.fieldEnd.localeCompare(b.fieldEnd) || a.id.localeCompare(b.id))
  const average = (rows: PollRecord[]) => {
    const total = rows.reduce((s, p) => s + p.sampleSize, 0)
    return rows.reduce((s, p) => s + p.support! * (p.sampleSize / total), 0)
  }
  let direction: PollTrend["direction"] = "insufficient_data"
  // At least three observations per disjoint comparison window. No significance claim.
  if (sorted.length >= 6) {
    const recent = sorted.slice(-3), older = sorted.slice(-6, -3)
    const firstRecentStart = recent.map(p => p.fieldStart).sort()[0]
    if (older.every(p => p.fieldEnd < firstRecentStart)) {
      const delta = average(recent) - average(older)
      direction = delta > 1 ? "up" : delta < -1 ? "down" : "stable"
    }
  }
  if (direction === "insufficient_data") warnings.push("Need two non-overlapping windows with at least three observations each to describe direction.")
  if (Date.parse(asOf) - Date.parse(sorted[sorted.length - 1].fieldEnd) > 30 * 86400000)
    warnings.push("Newest observation is over 30 days old; this is historical evidence.")
  return { geography, candidate, averageSupport: average(sorted), pollCount: sorted.length,
    // Retained for compatibility. Count alone cannot establish statistical confidence.
    confidence: "low", direction, warning: warnings.join(" ") }
}

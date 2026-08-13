import { createInspirationIdea, summarizeTrend, type TrendObservation, type TrendSource } from "./trendScout"

export type TrendConnector = {
  source: TrendSource
  collect: (query: string) => Promise<TrendObservation[]>
}

export async function scoutTrends(connectors: TrendConnector[], queries: string[]) {
  const observations: TrendObservation[] = []
  for (const query of queries) {
    for (const connector of connectors) {
      const found = await connector.collect(query)
      observations.push(...found)
    }
  }
  const patterns = summarizeTrend(observations)
  return { observations, patterns }
}

export function proposalFromScout(observations: TrendObservation[]) {
  if (!observations.length) return null
  const patterns = summarizeTrend(observations).slice(0, 3)
  const patternText = patterns.map(p => `${p.pattern} (${p.count} observations)`).join(", ")
  return createInspirationIdea(
    observations,
    "JhadinaTV trend experiment",
    `Detected recurring patterns: ${patternText}. Create an original experiment inspired by these patterns; do not reproduce source content.`
  )
}

/** Safe connector factory: the worker receives data from permitted APIs/search providers. */
export function connectorFromFetcher(source: TrendSource, fetcher: (query: string) => Promise<TrendObservation[]>): TrendConnector {
  return { source, collect: fetcher }
}

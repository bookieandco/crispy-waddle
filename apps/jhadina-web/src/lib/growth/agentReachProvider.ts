import type { TrendObservation, TrendSource } from "./trendScout"

export type AgentReachSearchOptions = { query: string; sources?: TrendSource[] }

/**
 * Adapter for Panniantong/Agent-Reach. The actual CLI runs outside Next.js;
 * this endpoint lets a worker/service return normalized Agent-Reach results.
 * Keep credentials/cookies on the worker machine and never in the web app.
 */
export function normalizeAgentReachResults(source: TrendSource, results: Array<{ title?: string; url?: string; text?: string; publishedAt?: string }>): TrendObservation[] {
  return results.map(r => ({
    source,
    title: r.title || "Untitled trend result",
    url: r.url,
    observedAt: r.publishedAt || new Date().toISOString(),
    signals: { topic: r.title },
    evidence: r.text ? [r.text.slice(0, 2000)] : [],
  }))
}

export async function searchViaAgentReach(options: AgentReachSearchOptions): Promise<TrendObservation[]> {
  const endpoint = process.env.AGENT_REACH_BRIDGE_URL
  const token = process.env.AGENT_REACH_BRIDGE_TOKEN
  if (!endpoint || !token) throw new Error("Agent Reach bridge is not configured. Set AGENT_REACH_BRIDGE_URL and AGENT_REACH_BRIDGE_TOKEN.")

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(options),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Agent Reach bridge returned ${response.status}`)
  const payload = await response.json() as { results?: Array<{ title?: string; url?: string; text?: string; publishedAt?: string; source?: TrendSource }> }
  return (payload.results || []).flatMap(r => normalizeAgentReachResults(r.source || "web", [r]))
}

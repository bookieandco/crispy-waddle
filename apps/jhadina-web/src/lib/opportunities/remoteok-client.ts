import {
  isRemoteOkAiJob,
  parseRemoteOkFeed,
  type RemoteOkJobListing,
} from "@jhadina/opportunity-core"

export const REMOTE_OK_API_URL = "https://remoteok.com/api"

export type RemoteOkDiscoveryOptions = {
  tag?: string
  limit?: number
}

export type RemoteOkDiscoveryResult = {
  source: "Remote OK"
  attributionRequired: true
  legal?: string
  lastUpdated?: number
  fetchedAt: string
  jobs: RemoteOkJobListing[]
}

/**
 * Server-side public-feed discovery. This discovers candidates only; it never
 * applies to a job, creates a referral, or bypasses Placement consent/policy.
 */
export async function discoverRemoteOkAiJobs(
  options: RemoteOkDiscoveryOptions = {},
  fetcher: typeof fetch = fetch,
): Promise<RemoteOkDiscoveryResult> {
  const limit = normalizeLimit(options.limit)
  const url = new URL(REMOTE_OK_API_URL)
  if (options.tag) url.searchParams.set("tag", normalizeTag(options.tag))

  const response = await fetcher(url.toString(), {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Remote OK discovery failed with HTTP ${response.status}`)

  const feed = parseRemoteOkFeed(await response.json())
  const jobs = feed.jobs.filter(isRemoteOkAiJob).slice(0, limit)

  return {
    source: "Remote OK",
    attributionRequired: true,
    legal: feed.legal,
    lastUpdated: feed.lastUpdated,
    fetchedAt: new Date().toISOString(),
    jobs,
  }
}

function normalizeLimit(value: number | undefined): number {
  if (value === undefined) return 25
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error("Remote OK limit must be an integer between 1 and 100")
  }
  return value
}

function normalizeTag(value: string): string {
  const tag = value.trim()
  if (!/^[a-z0-9+#._-]{1,40}$/i.test(tag)) {
    throw new Error("Remote OK tag is invalid")
  }
  return tag
}

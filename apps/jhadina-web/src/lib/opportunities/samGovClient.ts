import type { SamGovOpportunityRecord } from "./samGovAdapter"

const SAM_BASE_URL = "https://api.sam.gov/opportunities/v2/search"

export type SamGovSearchParams = {
  keyword?: string
  postedFrom?: string
  postedTo?: string
  limit?: number
  offset?: number
}

export class SamGovConfigurationError extends Error {}
export class SamGovRequestError extends Error {}

function getApiKey(): string {
  const key = process.env.SAM_GOV_API_KEY
  if (!key) throw new SamGovConfigurationError("SAM_GOV_API_KEY is not configured.")
  return key
}

function positiveInteger(value: number | undefined, fallback: number, max: number): number {
  const resolved = value ?? fallback
  if (!Number.isInteger(resolved) || resolved < 0 || resolved > max) {
    throw new Error(`Invalid SAM.gov pagination value: ${resolved}`)
  }
  return resolved
}

/**
 * Server-only SAM.gov client. The API key is read lazily from the environment
 * and is never returned to callers or included in response objects.
 */
export async function searchSamGovOpportunities(
  params: SamGovSearchParams = {},
): Promise<SamGovOpportunityRecord[]> {
  const apiKey = getApiKey()
  const limit = positiveInteger(params.limit, 25, 1000)
  const offset = positiveInteger(params.offset, 0, 100000)
  const url = new URL(SAM_BASE_URL)
  url.searchParams.set("api_key", apiKey)
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("offset", String(offset))
  if (params.keyword) url.searchParams.set("keyword", params.keyword)
  if (params.postedFrom) url.searchParams.set("postedFrom", params.postedFrom)
  if (params.postedTo) url.searchParams.set("postedTo", params.postedTo)

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new SamGovRequestError(`SAM.gov request failed with HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as { opportunitiesData?: SamGovOpportunityRecord[] }
  return Array.isArray(payload.opportunitiesData) ? payload.opportunitiesData : []
}

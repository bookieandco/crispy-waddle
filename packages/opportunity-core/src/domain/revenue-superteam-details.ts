import { createHash } from 'node:crypto'
import type { ZeroRigBountyListing } from './zero-rig-superteam.js'

/** JH-REVENUE.02: official Superteam GET-only detail validation.
 * This extends the existing Zero Rig listing scout; never registers, posts, claims or signs.
 */
export type SuperteamDetailConfig = {
  apiKey: string
  fetchImpl?: typeof fetch
}
export type SuperteamDetailReview = {
  listingId: string
  detailUrl: string
  sourceHash: string | null
  observedAt: string
  state: 'source_consistent' | 'blocked'
  blockers: string[]
  individualRewardUsd: null
  payoutVerified: false
  eligibilityVerified: false
  submissionAuthorized: false
  walletAuthorized: false
}
type Obj = Record<string, unknown>
const obj = (x: unknown): Obj | null => x !== null && typeof x === 'object' && !Array.isArray(x) ? x as Obj : null
const str = (x: unknown): string | null => typeof x === 'string' && x.trim() ? x.trim() : null
const ts = (x: unknown) => typeof x === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(x) && Number.isFinite(Date.parse(x)) ? Date.parse(x) : NaN
const origin = 'https://superteam.fun'

export function superteamDetailUrl(slug: string): string {
  if (!/^[a-z0-9-]{1,128}$/.test(slug)) throw new Error('REVENUE_SUPERTEAM_SLUG_INVALID')
  return origin + '/api/agents/listings/details/' + slug
}
async function strictJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error('REVENUE_SUPERTEAM_AUTH_BLOCKED')
    if (response.status === 429) throw new Error('REVENUE_SUPERTEAM_RATE_LIMIT')
    throw new Error('REVENUE_SUPERTEAM_PROVIDER_ERROR')
  }
  if (!/^application\/(?:json|[^;]+\+json)(?:;|$)/i.test(response.headers.get('content-type') ?? '')) {
    throw new Error('REVENUE_SUPERTEAM_JSON_REQUIRED')
  }
  const limit = 256 * 1024
  const size = response.headers.get('content-length')
  if (size && (!/^\d+$/.test(size) || Number(size) > limit)) throw new Error('REVENUE_SUPERTEAM_BODY_LIMIT')
  if (!response.body) throw new Error('REVENUE_SUPERTEAM_BODY_EMPTY')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const packet = await reader.read()
      if (packet.done) break
      length += packet.value.byteLength
      if (length > limit) {
        await reader.cancel().catch(() => undefined)
        throw new Error('REVENUE_SUPERTEAM_BODY_LIMIT')
      }
      chunks.push(packet.value)
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'REVENUE_SUPERTEAM_BODY_LIMIT') throw error
    throw new Error('REVENUE_SUPERTEAM_BODY_READ_ERROR')
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(length)
  let pos = 0
  for (const chunk of chunks) { bytes.set(chunk, pos); pos += chunk.length }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown }
  catch { throw new Error('REVENUE_SUPERTEAM_INVALID_JSON') }
}
export function createRevenueSuperteamDetailReader(config: SuperteamDetailConfig) {
  const key = config.apiKey.trim()
  if (!/^sk_[A-Za-z0-9_-]{8,}$/.test(key)) throw new Error('REVENUE_SUPERTEAM_KEY_MISSING')
  const transport = config.fetchImpl ?? fetch
  return {
    async readDetail(slug: string): Promise<unknown> {
      const url = superteamDetailUrl(slug)
      let response: Response
      try {
        response = await transport(url, {
          method: 'GET', redirect: 'error', cache: 'no-store',
          headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
        })
      } catch { throw new Error('REVENUE_SUPERTEAM_CONNECTION_FAILED') }
      return strictJson(response)
    },
  }
}
/** This is a consistency check on untrusted provider data, not a verified payout claim. */
export function reviewRevenueSuperteamDetail(
  body: unknown,
  summary: ZeroRigBountyListing,
  observedAt: string,
): SuperteamDetailReview {
  const now = ts(observedAt)
  if (!Number.isFinite(now)) throw new Error('REVENUE_OBSERVATION_TIME_INVALID')
  const envelope = obj(body)
  const listing = obj(envelope?.result) ?? obj(envelope?.listing) ?? obj(envelope?.data) ?? envelope
  const blockers: string[] = []
  if (!listing) blockers.push('DETAIL_MISSING')
  if (str(listing?.id) !== summary.id || str(listing?.slug) !== summary.slug) blockers.push('LISTING_ID_CHANGED')
  if (str(listing?.title) !== summary.title) blockers.push('LISTING_TITLE_CHANGED')
  if (listing?.status !== 'OPEN' || listing?.isWinnersAnnounced === true) blockers.push('LISTING_NOT_OPEN')
  if (listing?.agentAccess !== summary.agentAccess ||
    !['AGENT_ALLOWED', 'AGENT_ONLY'].includes(String(listing?.agentAccess ?? ''))) blockers.push('AI_NOT_ELIGIBLE')
  const deadline = ts(listing?.deadline)
  if (!Number.isFinite(deadline) || deadline <= now || deadline !== ts(summary.deadline)) blockers.push('DEADLINE_NOT_CURRENT')
  if (listing?.type !== summary.listingType) blockers.push('TYPE_CHANGED')
  // Provider reward amounts may be TOTAL POOLS; never infer individual cash.
  const normalized = { id:listing?.id, slug:listing?.slug, title:listing?.title,
    status:listing?.status, agentAccess:listing?.agentAccess, deadline:listing?.deadline,
    type:listing?.type, compensationType:listing?.compensationType,
    rewardAmount:listing?.rewardAmount, rewards:listing?.rewards }
  const sourceHash = listing
    ? createHash('sha256').update(JSON.stringify(normalized)).digest('hex') : null
  return {
    listingId: summary.id, detailUrl: superteamDetailUrl(summary.slug), sourceHash,
    observedAt: new Date(now).toISOString(), state:blockers.length ? 'blocked' : 'source_consistent',
    blockers, individualRewardUsd:null, payoutVerified:false, eligibilityVerified:false,
    submissionAuthorized:false, walletAuthorized:false,
  }
}

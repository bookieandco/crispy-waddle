import {
  SUPERTEAM_AGENT_LISTINGS_ENDPOINT,
  type SuperteamReadOnlyListingReader,
} from './zero-rig-superteam.js'

/** JH-ZERO-RIG.LIVE.01 — fixed-host, GET-only, bounded transport. */
export type ZeroRigSuperteamReadConfig = {
  apiKey: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
  maxBodyBytes?: number
}

const MAX_ITEMS = 50
const DEFAULT_MAX_BODY_BYTES = 256 * 1024
const DEFAULT_TIMEOUT_MS = 8_000

export function createZeroRigSuperteamReader(config: ZeroRigSuperteamReadConfig): SuperteamReadOnlyListingReader {
  // Fail before network access; this is a server-only secret passed by the route.
  const key = config.apiKey.trim()
  if (!/^sk_[A-Za-z0-9_-]{8,}$/.test(key)) throw new Error('ZERO_RIG_AGENT_CREDENTIAL_NOT_CONFIGURED')
  const timeout = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const limit = config.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES
  if (!Number.isSafeInteger(timeout) || timeout < 100 || timeout > 8_000 ||
      !Number.isSafeInteger(limit) || limit < 1024 || limit > DEFAULT_MAX_BODY_BYTES) {
    throw new Error('ZERO_RIG_TRANSPORT_LIMIT_INVALID')
  }
  const transport = config.fetchImpl ?? fetch
  return {
    async readLiveListings({take, deadline}) {
      if (!Number.isInteger(take) || take < 1 || take > MAX_ITEMS) {
        throw new Error('ZERO_RIG_TAKE_OUT_OF_BOUNDS')
      }
      const time = Date.parse(deadline)
      if (!Number.isFinite(time) || !/^\d{4}-\d{2}-\d{2}T/.test(deadline)) {
        throw new Error('ZERO_RIG_DEADLINE_INVALID')
      }
      const url = new URL(SUPERTEAM_AGENT_LISTINGS_ENDPOINT)
      if (url.origin !== 'https://superteam.fun' || url.pathname !== '/api/agents/listings/live') {
        throw new Error('ZERO_RIG_PROVIDER_ENDPOINT_INVALID')
      }
      url.searchParams.set('take', String(take))
      url.searchParams.set('deadline', deadline)
      let response: Response
      try {
        response = await transport(url.toString(), {
          method: 'GET',
          headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' },
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(timeout),
        })
      } catch {
        // Never expose the URL, auth bearer, upstream body or fetch stack in a route.
        throw new Error('ZERO_RIG_PROVIDER_REQUEST_FAILED')
      }
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error('ZERO_RIG_PROVIDER_AUTH_REJECTED')
        if (response.status === 429) throw new Error('ZERO_RIG_PROVIDER_RATE_LIMITED')
        throw new Error('ZERO_RIG_PROVIDER_UNAVAILABLE')
      }
      const contentType = response.headers.get('content-type') ?? ''
      if (!/^application\/(json|[^;]+\+json)(;|$)/i.test(contentType)) {
        throw new Error('ZERO_RIG_PROVIDER_CONTENT_TYPE_INVALID')
      }
      const length = response.headers.get('content-length')
      if (length && (!/^\d+$/.test(length) || Number(length) > limit)) {
        throw new Error('ZERO_RIG_PROVIDER_RESPONSE_TOO_LARGE')
      }
      // Stream with a hard byte limit; Content-Length is not trusted.
      const stream = response.body?.getReader()
      if (!stream) throw new Error('ZERO_RIG_PROVIDER_BODY_MISSING')
      const pieces: Uint8Array[] = []
      let count = 0
      try {
        for (;;) {
          const next = await stream.read()
          if (next.done) break
          count += next.value.byteLength
          if (count > limit) throw new Error('ZERO_RIG_PROVIDER_RESPONSE_TOO_LARGE')
          pieces.push(next.value)
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'ZERO_RIG_PROVIDER_RESPONSE_TOO_LARGE') throw error
        throw new Error('ZERO_RIG_PROVIDER_BODY_READ_FAILED')
      } finally {
        stream.releaseLock()
        if (count > limit) await response.body?.cancel().catch(() => undefined)
      }
      const bytes = new Uint8Array(count)
      let cursor = 0
      for (const piece of pieces) { bytes.set(piece, cursor); cursor += piece.byteLength }
      try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown }
      catch { throw new Error('ZERO_RIG_PROVIDER_JSON_INVALID') }
    },
  }
}

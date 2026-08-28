import type { CorporateSearchRequest, CorporateSearchResult } from './corporate-intelligence-connector'

export interface CorporateCacheEntry { key: string; request: CorporateSearchRequest; result: CorporateSearchResult; cachedAt: string; expiresAt: string }
export interface CorporateCacheStore { get(key: string): Promise<CorporateCacheEntry | null>; set(entry: CorporateCacheEntry): Promise<void> }
export interface CorporateRateLimitGuard { canRequest(provider: string, now?: number): boolean; recordRequest(provider: string, now?: number): void }

function keyFor(request: CorporateSearchRequest): string {
  return [request.legalName, request.jurisdiction ?? '', request.registrationNumber ?? ''].map((value) => value.trim().toLowerCase().replace(/\s+/g, ' ')).join('|')
}

export class InMemoryCorporateCache implements CorporateCacheStore {
  private readonly entries = new Map<string, CorporateCacheEntry>()
  async get(key: string): Promise<CorporateCacheEntry | null> {
    const entry = this.entries.get(key)
    if (!entry) return null
    if (Date.parse(entry.expiresAt) <= Date.now()) { this.entries.delete(key); return null }
    return entry
  }
  async set(entry: CorporateCacheEntry): Promise<void> { this.entries.set(entry.key, entry) }
}

export class SlidingWindowRateLimitGuard implements CorporateRateLimitGuard {
  private readonly requests = new Map<string, number[]>()
  constructor(private readonly maxRequests: number, private readonly windowMs: number) {
    if (maxRequests < 1 || windowMs < 1) throw new Error('rate limit values must be positive')
  }
  canRequest(provider: string, now = Date.now()): boolean {
    const recent = (this.requests.get(provider) ?? []).filter((timestamp) => now - timestamp < this.windowMs)
    this.requests.set(provider, recent)
    return recent.length < this.maxRequests
  }
  recordRequest(provider: string, now = Date.now()): void {
    if (!this.canRequest(provider, now)) throw new Error(`rate limit exceeded for provider: ${provider}`)
    this.requests.get(provider)!.push(now)
  }
}

/** Cache-first corporate lookup with request deduplication and provider rate-limit protection. */
export async function cachedCorporateSearch(connector: { provider: string; search(request: CorporateSearchRequest): Promise<CorporateSearchResult> }, store: CorporateCacheStore, guard: CorporateRateLimitGuard, request: CorporateSearchRequest, ttlMs: number, now = Date.now()): Promise<CorporateSearchResult> {
  if (ttlMs < 1) throw new Error('ttlMs must be positive')
  const key = keyFor(request)
  const cached = await store.get(key)
  if (cached) return cached.result
  if (!guard.canRequest(connector.provider, now)) throw new Error(`rate limit exceeded for provider: ${connector.provider}`)
  guard.recordRequest(connector.provider, now)
  const result = await connector.search(request)
  const cachedAt = new Date(now).toISOString()
  await store.set({ key, request, result, cachedAt, expiresAt: new Date(now + ttlMs).toISOString() })
  return result
}

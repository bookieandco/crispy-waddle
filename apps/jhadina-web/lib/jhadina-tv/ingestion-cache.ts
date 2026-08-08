import type { AuthorizedMediaSource } from './media-source'
import type { IngestionResult, SourceIngestionAdapter } from './ingestion'

export interface CachedIngestion {
  sourceId: string
  items: AuthorizedMediaSource[]
  fetchedAt: string
  expiresAt: string
}

export interface IngestionCache {
  get(sourceId: string): CachedIngestion | undefined
  set(entry: CachedIngestion): void
  delete(sourceId: string): void
  clear(): void
}

export class MemoryIngestionCache implements IngestionCache {
  private readonly entries = new Map<string, CachedIngestion>()

  get(sourceId: string): CachedIngestion | undefined {
    const entry = this.entries.get(sourceId)
    if (!entry) return undefined
    if (Date.now() >= Date.parse(entry.expiresAt)) {
      this.entries.delete(sourceId)
      return undefined
    }
    return entry
  }

  set(entry: CachedIngestion): void { this.entries.set(entry.sourceId, entry) }
  delete(sourceId: string): void { this.entries.delete(sourceId) }
  clear(): void { this.entries.clear() }
}

export interface OrchestratorOptions {
  ttlMs?: number
  now?: () => Date
}

export class SourceIngestionOrchestrator {
  private readonly ttlMs: number
  private readonly now: () => Date

  constructor(
    private readonly adapters: SourceIngestionAdapter[],
    private readonly cache: IngestionCache = new MemoryIngestionCache(),
    options: OrchestratorOptions = {},
  ) {
    this.ttlMs = options.ttlMs ?? 15 * 60 * 1000
    this.now = options.now ?? (() => new Date())
  }

  async ingest(sourceId: string, forceRefresh = false): Promise<IngestionResult> {
    if (!forceRefresh) {
      const cached = this.cache.get(sourceId)
      if (cached) return { sourceId: cached.sourceId, items: cached.items, fetchedAt: cached.fetchedAt }
    }

    const adapter = this.adapters.find((candidate) => candidate.sourceId === sourceId)
    if (!adapter) throw new Error(`No ingestion adapter registered for ${sourceId}`)

    const result = await adapter.ingest()
    const fetchedAt = this.now().toISOString()
    this.cache.set({
      sourceId: result.sourceId,
      items: result.items,
      fetchedAt,
      expiresAt: new Date(this.now().getTime() + this.ttlMs).toISOString(),
    })
    return { ...result, fetchedAt }
  }

  async ingestAll(forceRefresh = false): Promise<IngestionResult[]> {
    return Promise.all(this.adapters.map((adapter) => this.ingest(adapter.sourceId, forceRefresh)))
  }

  cached(sourceId: string): CachedIngestion | undefined { return this.cache.get(sourceId) }
}

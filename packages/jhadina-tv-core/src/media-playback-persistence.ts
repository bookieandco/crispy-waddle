export interface MediaPlaybackProgress {
  userId: string;
  providerId: string;
  itemId: string;
  positionMs: number;
  durationMs?: number;
  completed: boolean;
  updatedAt: string;
}

/**
 * Persistence boundary only. Media Core does not know about Supabase,
 * credentials, or database row naming.
 */
export interface MediaPlaybackProgressRepository {
  get(userId: string, providerId: string, itemId: string): Promise<MediaPlaybackProgress | null>;
  upsert(progress: MediaPlaybackProgress): Promise<MediaPlaybackProgress>;
}

export class InMemoryMediaPlaybackProgressRepository implements MediaPlaybackProgressRepository {
  private readonly records = new Map<string, MediaPlaybackProgress>();

  private key(userId: string, providerId: string, itemId: string) {
    return `${userId}:${providerId}:${itemId}`;
  }

  async get(userId: string, providerId: string, itemId: string) {
    const record = this.records.get(this.key(userId, providerId, itemId));
    return record ? { ...record } : null;
  }

  async upsert(progress: MediaPlaybackProgress) {
    const key = this.key(progress.userId, progress.providerId, progress.itemId);
    const existing = this.records.get(key);

    // Database and in-memory implementations share the same deterministic
    // freshness rule: only strictly newer events may replace stored progress.
    if (existing && progress.updatedAt <= existing.updatedAt) return { ...existing };

    const copy = { ...progress, positionMs: Math.max(0, Math.trunc(progress.positionMs)) };
    this.records.set(key, copy);
    return { ...copy };
  }
}

export function isMeaningfulResume(progress: MediaPlaybackProgress | null, minimumMs = 5_000) {
  return Boolean(progress && progress.positionMs >= minimumMs && !progress.completed);
}

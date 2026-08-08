import type { MusicRepository } from "./repository.js";

/**
 * Persistence boundary for production Music Core storage.
 * The concrete SQL client is injected so Music Core stays independent of
 * Supabase/Postgres SDK details and remains straightforward to test.
 */
export interface MusicSqlClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export class PostgresMusicRepository {
  constructor(private readonly db: MusicSqlClient) {}

  async searchTracks(userId: string, query: string) {
    const result = await this.db.query<{
      id: string; title: string; artist_ids: string[]; album_id: string | null;
      duration_ms: number | null; isrc: string | null; explicit: boolean | null;
      artwork_id: string | null; external_ids: Record<string, string>;
    }>(
      `select id, title, artist_ids, album_id, duration_ms, isrc, explicit, artwork_id, external_ids
       from music_tracks
       where user_id = $1
         and (lower(title) like '%' || lower($2) || '%' or lower(coalesce(isrc, '')) = lower($2))
       order by case when lower(title) = lower($2) then 0 else 1 end, title
       limit 50`,
      [userId, query.trim()],
    );
    return result.rows;
  }
}

export type { MusicRepository };

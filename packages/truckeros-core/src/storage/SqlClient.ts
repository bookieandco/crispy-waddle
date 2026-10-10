/**
 * Persistence boundary for production TruckerOS storage. The concrete SQL
 * client (pg, Supabase's client, whatever) is injected so this package
 * never depends on a specific driver/SDK. Mirrors @jhadina/music-core's
 * MusicSqlClient.
 */
export interface SqlClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

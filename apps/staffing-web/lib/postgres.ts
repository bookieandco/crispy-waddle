import type { SqlExecutor } from "../../../packages/staffing-core/src/postgres-adapters.js";

/**
 * Infrastructure boundary for the standalone web application.
 * The concrete Supabase/Postgres client is injected by the runtime so core
 * remains independent of Next.js and provider SDKs.
 */
export function createSqlExecutor(client: {
  query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}): SqlExecutor {
  return client;
}

import type { SqlExecutor } from "./postgres-adapters.js";

export interface PostgresTestClient extends SqlExecutor {
  close(): Promise<void>;
}

/**
 * CI supplies the concrete pg driver. Keeping the factory injectable avoids
 * coupling staffing-core production code to a specific Postgres client.
 */
export async function createSqlExecutor(databaseUrl: string): Promise<PostgresTestClient> {
  if (!databaseUrl) throw new Error("STAFFING_TEST_DATABASE_URL is required");
  throw new Error("Postgres test driver is not configured; inject the CI adapter for this package");
}

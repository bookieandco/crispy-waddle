import type { SqlExecutor } from "./postgres-adapters.js";

export interface PostgresTestClient extends SqlExecutor {
  close(): Promise<void>;
}

export type PostgresTestExecutorFactory = (databaseUrl: string) => Promise<PostgresTestClient>;

let factory: PostgresTestExecutorFactory | undefined;

export function configurePostgresTestExecutor(next: PostgresTestExecutorFactory): void {
  factory = next;
}

export async function createSqlExecutor(databaseUrl: string): Promise<PostgresTestClient> {
  if (!databaseUrl) throw new Error("STAFFING_TEST_DATABASE_URL is required");
  if (!factory) throw new Error("No Postgres test executor configured");
  return factory(databaseUrl);
}

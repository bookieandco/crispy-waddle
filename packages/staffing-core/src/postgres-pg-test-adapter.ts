import type { Pool, PoolClient, QueryResultRow } from "pg";
import type { SqlExecutor } from "./postgres-adapters.js";

export interface PgPoolLike {
  connect(): Promise<PoolClient>;
  query<T extends QueryResultRow = any>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
  end(): Promise<void>;
}

export class PgSqlExecutor implements SqlExecutor {
  constructor(private readonly pool: PgPoolLike) {}

  async query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const tx: SqlExecutor = {
        query: async <R = any>(sql: string, params: unknown[] = []) => {
          const result = await client.query(sql, params);
          return result.rows as R[];
        },
        transaction: async <R>(nested: (executor: SqlExecutor) => Promise<R>) => nested(tx),
      };
      const result = await work(tx);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createPgSqlExecutor(pool: PgPoolLike): PgSqlExecutor {
  return new PgSqlExecutor(pool);
}

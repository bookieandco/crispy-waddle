import { Pool, type PoolConfig } from 'pg';

import type { SqlClient } from './postgres-idempotency-store.js';

/** Creates the real PostgreSQL client used by money-core infrastructure. */
export function createPostgresClient(config: PoolConfig = {}): SqlClient & { end(): Promise<void> } {
  const pool = new Pool(config);

  return {
    async query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]) {
      // pg's `query<R extends QueryResultRow>` can't be parameterized by SqlClient's
      // unconstrained T directly; let pg infer its own row type and cast the result
      // to the driver-agnostic shape SqlClient callers expect.
      const result = await pool.query(text, values ? [...values] : undefined);
      return result as unknown as { rows: T[] };
    },
    end: () => pool.end(),
  };
}

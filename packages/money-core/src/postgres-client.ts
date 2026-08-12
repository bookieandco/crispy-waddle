import { Pool, type PoolConfig } from 'pg';

import type { SqlClient } from './postgres-idempotency-store.js';

/** Creates the real PostgreSQL client used by money-core infrastructure. */
export function createPostgresClient(config: PoolConfig = {}): SqlClient & { end(): Promise<void> } {
  const pool = new Pool(config);

  return {
    async query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]) {
      return pool.query<T>(text, values ? [...values] : undefined);
    },
    end: () => pool.end(),
  };
}

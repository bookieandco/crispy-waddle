import type { ReplayGuard } from './hardened-boundary.js';

export interface SecuritySqlExecutor {
  query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T[]>;
}

/**
 * Durable replay protection backed by PostgreSQL.
 *
 * The database function performs the nonce insert atomically. This is the
 * production implementation for multi-instance Jhadina deployments; the
 * in-memory guard remains suitable only for tests/local development.
 */
export class PostgresReplayGuard implements ReplayGuard {
  constructor(private readonly db: SecuritySqlExecutor) {}

  async has(nonce: string): Promise<boolean> {
    const rows = await this.db.query<{ exists: boolean }>(
      `select exists(
         select 1
         from public.jhadina_security_replay_nonces
         where nonce = $1
           and expires_at > now()
       ) as exists`,
      [nonce],
    );
    return rows[0]?.exists === true;
  }

  async consume(nonce: string, expiresAt: number): Promise<boolean> {
    if (!nonce || !Number.isSafeInteger(expiresAt)) return false;

    const rows = await this.db.query<{ accepted: boolean }>(
      `select public.consume_jhadina_security_nonce($1, $2) as accepted`,
      [nonce, new Date(expiresAt)],
    );
    return rows[0]?.accepted === true;
  }
}

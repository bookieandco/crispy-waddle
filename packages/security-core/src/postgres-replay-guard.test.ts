import { describe, expect, it, vi } from 'vitest';
import { PostgresReplayGuard, type SecuritySqlExecutor } from './postgres-replay-guard.js';

describe('PostgresReplayGuard', () => {
  it('atomically consumes a nonce through the database function', async () => {
    const query = vi.fn().mockResolvedValue([{ accepted: true }]);
    const guard = new PostgresReplayGuard({ query } satisfies SecuritySqlExecutor);

    const result = await guard.consume('nonce-1234567890', Date.now() + 30_000);

    expect(result).toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('consume_jhadina_security_nonce'),
      expect.arrayContaining(['nonce-1234567890', expect.any(Date)]),
    );
  });

  it('rejects malformed or unsafe expiry input before touching the database', async () => {
    const query = vi.fn();
    const guard = new PostgresReplayGuard({ query } satisfies SecuritySqlExecutor);

    expect(await guard.consume('', Date.now() + 30_000)).toBe(false);
    expect(await guard.consume('nonce-1234567890', Number.NaN)).toBe(false);
    expect(await guard.consume('nonce-1234567890', Number.POSITIVE_INFINITY)).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it('reports an already-consumed nonce as rejected', async () => {
    const query = vi.fn().mockResolvedValue([{ accepted: false }]);
    const guard = new PostgresReplayGuard({ query } satisfies SecuritySqlExecutor);

    expect(await guard.consume('nonce-1234567890', Date.now() + 30_000)).toBe(false);
  });

  it('can inspect durable state for an active nonce', async () => {
    const query = vi.fn().mockResolvedValue([{ exists: true }]);
    const guard = new PostgresReplayGuard({ query } satisfies SecuritySqlExecutor);

    expect(await guard.has('nonce-1234567890')).toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('jhadina_security_replay_nonces'),
      ['nonce-1234567890'],
    );
  });
});

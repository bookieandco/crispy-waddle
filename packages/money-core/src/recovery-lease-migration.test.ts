import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const migrationPath = new URL('../migrations/005_create_money_execution_recovery_lease_functions.sql', import.meta.url);

test('recovery lease migration defines required database functions', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.claim_money_execution_recovery_lease\(/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.renew_money_execution_recovery_lease\(/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.release_money_execution_recovery_lease\(/);
});

test('recovery lease migration calculates expiration from now plus lease seconds', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  assert.match(sql, /v_expiry\s*:=\s*v_now\s*\+\s*make_interval\(secs => p_lease_seconds::double precision\)/);
  assert.doesNotMatch(sql, /recovery_lease_expires_at\s*=\s*v_now\b/);
  assert.doesNotMatch(sql, /recovery_lease_expires_at\s*=\s*CURRENT_TIMESTAMP\b/);
});

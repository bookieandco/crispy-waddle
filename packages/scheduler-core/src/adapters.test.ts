import { describe, expect, it } from 'vitest';
import {
  githubActionsScheduleAdapter,
  homebaseScheduleAdapter,
  vercelCronAdapter,
} from './adapters';
import type { Schedule } from './schedule';

const schedule: Schedule = {
  id: 'director-reconcile',
  name: 'Director reconciliation',
  expression: '*/5 * * * *',
  dialect: 'posix',
  timezone: 'UTC',
  enabled: true,
  target: '/api/director/reconcile',
  timeoutMs: 30_000,
  overlapPolicy: 'skip',
  maxConcurrency: 1,
};

describe('scheduler platform adapters', () => {
  it('compiles canonical schedules for Vercel Cron', () => {
    expect(vercelCronAdapter.compile(schedule)).toEqual({
      path: '/api/director/reconcile',
      schedule: '*/5 * * * *',
    });
  });

  it('rejects non-UTC schedules for Vercel rather than changing semantics', () => {
    expect(() => vercelCronAdapter.compile({ ...schedule, timezone: 'America/New_York' })).toThrow(
      'requires timezone=UTC',
    );
  });

  it('preserves timezone when compiling GitHub Actions schedules', () => {
    expect(githubActionsScheduleAdapter.compile(schedule)).toEqual({
      cron: '*/5 * * * *',
      timezone: 'UTC',
    });
  });

  it('preserves execution metadata for Homebase', () => {
    expect(homebaseScheduleAdapter.compile(schedule)).toEqual({
      id: 'director-reconcile',
      expression: '*/5 * * * *',
      timezone: 'UTC',
      target: '/api/director/reconcile',
      enabled: true,
    });
  });
});

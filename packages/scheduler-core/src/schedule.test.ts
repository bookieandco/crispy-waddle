import { describe, expect, it } from 'vitest';
import { validateSchedule } from './schedule';

describe('validateSchedule', () => {
  const valid = {
    id: 'director-reconciliation',
    name: 'Director submission reconciliation',
    expression: '*/5 * * * *',
    dialect: 'posix' as const,
    timezone: 'UTC',
    enabled: true,
    target: '/api/cron/director-submissions',
    timeoutMs: 30_000,
    overlapPolicy: 'skip' as const,
    maxConcurrency: 1,
  };

  it('accepts and canonicalizes a valid schedule', () => {
    const result = validateSchedule({ ...valid, expression: '  */5   * * * *  ' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.expression).toBe('*/5 * * * *');
  });

  it('rejects malformed cron expressions at the boundary', () => {
    const result = validateSchedule({ ...valid, expression: 'every five minutes' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.field === 'expression')).toBe(true);
  });

  it('rejects invalid timezones instead of passing them to a scheduler adapter', () => {
    const result = validateSchedule({ ...valid, timezone: 'Not/A_Timezone' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((issue) => issue.field === 'timezone')).toBe(true);
  });

  it('rejects unsafe concurrency and timeout values', () => {
    const result = validateSchedule({ ...valid, timeoutMs: -1, maxConcurrency: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.field)).toEqual(expect.arrayContaining(['timeoutMs', 'maxConcurrency']));
    }
  });

  it('rejects unknown overlap policies', () => {
    const result = validateSchedule({ ...valid, overlapPolicy: 'queue' });
    expect(result.ok).toBe(false);
  });
});

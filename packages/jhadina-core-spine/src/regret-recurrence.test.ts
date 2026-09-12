import { describe, expect, it } from 'vitest';
import type { RegretMemoryRecord } from './regret-memory.js';
import { deriveRegretRecurrence, nextRegretRecurrence } from './regret-recurrence.js';

const record = (rootCause: string, status: 'verified' | 'learned' | 'proposed', userId = 'user-1'): RegretMemoryRecord => ({
  memoryId: `${userId}-${rootCause}-${status}`,
  userId,
  createdAt: '2026-09-12T00:00:00.000Z',
  provenance: Object.freeze([{ id: 'e1', source: 'test', observedAt: '2026-09-12T00:00:00.000Z', summary: 'verified test evidence', immutable: true }]),
  tags: Object.freeze([]),
  salience: 0.5,
  regret: Object.freeze({
    regretId: `${userId}-${rootCause}-${status}`,
    subjectType: 'decision',
    subjectId: 'subject-1',
    createdAt: '2026-09-12T00:00:00.000Z',
    originalBelief: 'belief',
    expectedOutcome: 'expected',
    actualOutcome: 'actual',
    outcomeEvidence: Object.freeze([{ id: 'e1', source: 'test', observedAt: '2026-09-12T00:00:00.000Z', summary: 'verified test evidence', immutable: true }]),
    discrepancy: 'discrepancy',
    severity: 'R2',
    avoidability: 'high',
    rootCause,
    recurrenceCount: 99,
    status,
  }),
});

describe('regret recurrence authority', () => {
  it('derives first occurrence from empty history', () => {
    expect(nextRegretRecurrence([], 'missed-check')).toBe(1);
  });

  it('increments only matching verified or learned history', () => {
    const history = [
      record('missed-check', 'verified'),
      record('missed-check', 'learned'),
      record('other-cause', 'verified'),
      record('missed-check', 'proposed'),
    ];
    expect(deriveRegretRecurrence(history, 'missed-check')).toBe(2);
    expect(nextRegretRecurrence(history, 'missed-check')).toBe(3);
  });

  it('does not trust stored recurrenceCount values', () => {
    const history = [record('missed-check', 'verified')];
    expect(nextRegretRecurrence(history, 'missed-check')).toBe(2);
  });

  it('requires a root cause for deterministic recurrence', () => {
    expect(() => nextRegretRecurrence([], '   ')).toThrow('regret_recurrence_root_cause_required');
  });

  it('relies on the memory boundary for user isolation', () => {
    const userOneHistory = [record('missed-check', 'verified', 'user-1')];
    const userTwoHistory = [record('missed-check', 'verified', 'user-2'), record('missed-check', 'verified', 'user-2')];
    expect(nextRegretRecurrence(userOneHistory, 'missed-check')).toBe(2);
    expect(nextRegretRecurrence(userTwoHistory, 'missed-check')).toBe(3);
  });
});

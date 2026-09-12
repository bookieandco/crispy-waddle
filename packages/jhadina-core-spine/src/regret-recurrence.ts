import type { RegretRecord } from './regret.js';
import type { RegretMemoryRecord } from './regret-memory.js';

/**
 * Recurrence is a property of verified historical events, not caller-provided
 * metadata. Only verified/learned records for the same user and root cause
 * contribute to the next recurrence count.
 */
export function deriveRegretRecurrence(
  history: readonly RegretMemoryRecord[],
  rootCause: string,
): number {
  if (!rootCause.trim()) throw new Error('regret_recurrence_root_cause_required');

  const verified = history.filter(
    (record) =>
      record.regret.rootCause === rootCause &&
      (record.regret.status === 'verified' || record.regret.status === 'learned'),
  );

  return verified.length;
}

/**
 * Produces the next immutable recurrence count for a newly materialized regret.
 * The history itself is never mutated and no record's stored recurrence count
 * is trusted as authoritative for the count.
 */
export function nextRegretRecurrence(
  history: readonly RegretMemoryRecord[],
  rootCause: string,
): number {
  return deriveRegretRecurrence(history, rootCause) + 1;
}

/**
 * Computes pressure from the authoritative historical recurrence rather than
 * accepting a caller-controlled recurrence count.
 */
export function calculateHistoricalRegretPressure(
  regret: Pick<RegretRecord, 'severity' | 'avoidability'>,
  history: readonly RegretMemoryRecord[],
): number {
  const rootCause = history.find((record) => record.regret.severity === regret.severity && record.regret.avoidability === regret.avoidability)?.regret.rootCause;
  if (!rootCause) return 0;
  const recurrence = deriveRegretRecurrence(history, rootCause);
  const severityWeight: Record<RegretRecord['severity'], number> = { R0: 0, R1: 1, R2: 2, R3: 3, R4: 4, R5: 5 };
  const avoidabilityWeight: Record<RegretRecord['avoidability'], number> = { unknown: 0, low: 0.25, medium: 0.5, high: 1 };
  return Math.min(100, severityWeight[regret.severity] * Math.max(1, recurrence) * avoidabilityWeight[regret.avoidability] * 20);
}

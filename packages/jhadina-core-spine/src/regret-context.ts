import type { RegretContext } from './types.js';
import type { RegretMemory, RegretMemoryQuery } from './regret-memory.js';

/**
 * Converts regret retrieval into bounded context for JANET.
 *
 * This adapter is intentionally read-only. It cannot append, supersede,
 * approve, execute, or change policy. Regret remains a learning signal,
 * never a canonical fact or authority source.
 */
export interface JanetRegretContextOptions {
  readonly userId: string;
  readonly query: string;
  readonly limit?: number;
}

export async function buildJanetRegretContext(
  memory: RegretMemory,
  options: JanetRegretContextOptions,
): Promise<readonly RegretContext[]> {
  const query: RegretMemoryQuery = {
    userId: options.userId,
    text: options.query,
    limit: options.limit ?? 5,
    includeSuperseded: false,
  };

  return memory.retrieve(query).map(({ memoryId, score, record }) => ({
    memoryId,
    score,
    subjectType: record.regret.subjectType,
    subjectId: record.regret.subjectId,
    discrepancy: record.regret.discrepancy,
    rootCause: record.regret.rootCause,
    recurrenceCount: record.regret.recurrenceCount,
    status: record.regret.status,
    salience: record.salience,
  }));
}

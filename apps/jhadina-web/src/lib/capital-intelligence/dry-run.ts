import type { MoneyTransaction } from '@jhadina/money-core';
import { replayTransactions, type ReplayClassificationResolver, type ReplayResult } from './replay';

export type CapitalDryRunReport = ReplayResult & {
  sourceCount: number;
  classifiedCount: number;
  unresolvedCount: number;
  errorCount: number;
  positionCount: number;
  lotCount: number;
};

/**
 * Read-only Capital Intelligence analysis. It accepts transactions already
 * obtained through Money Core's authorized read boundary and never persists or
 * executes financial actions.
 */
export function runCapitalDryRun(
  transactions: MoneyTransaction[],
  resolveClassification: ReplayClassificationResolver,
): CapitalDryRunReport {
  const replay = replayTransactions(transactions, resolveClassification);
  return {
    ...replay,
    sourceCount: transactions.length,
    classifiedCount: replay.applied.length,
    unresolvedCount: replay.unresolved.length,
    errorCount: replay.errors.length,
    positionCount: replay.state.positions.length,
    lotCount: replay.state.lots.length,
  };
}
